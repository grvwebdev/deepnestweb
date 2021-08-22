const express = require('express');
const path = require('path');

const { ipcRenderer } = require('electron'); 
const fs = require('graceful-fs');
const request = require('request');
const http = require('http');
const url = require('url')


const app = express();
const fileUpload = require("express-fileupload");
app.use(fileUpload());
const uuidv4 = require('uuid/v4'); 
const port = process.env.PORT || 8080;
const addon = require('./minkowski/Release/addon');
app.on('ready', () => {
  mainWindow = new BrowserWindow({
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
      }
  });
});

app.use(express.static(path.join(__dirname, 'main')));

// sendFile will go here
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/main/index2.html'));
});

app.post('/import', (req, res) => {
	data = [];
	if(Array.isArray(req.files.importFiles)){
		for(var i = 0; i<req.files.importFiles.length; i++){
			data.push(processFile(req.files.importFiles[i]))
		}
	}else{
		data.push(processFile(req.files.importFiles))
	}		
	res.end(JSON.stringify(data));
});

function processFile(file){
	var ext = path.extname(file.name);
	var filename = path.basename(file.name);
	if(ext.toLowerCase() == '.svg'){
		readFileData = readFile(file);
		// importbutton.className = 'button import';
		return {data:readFileData.fileStr, name:file.name, dirpath:readFileData.dirpath, scalingFactor:null }
	}else{
		importbutton.className = 'button import spinner';
		// send to conversion server
		var url = config.getSync('conversionServer');
		if(!url){
			url = defaultConversionServer;
		}
		
		var req = request.post(url, function (err, resp, body) {
			importbutton.className = 'button import';
			if (err) {
				message('could not contact file conversion server', true);
			} else {
				if(body.substring(0, 5) == 'error'){
					message(body, true);
				}
				else{
					// expected input dimensions on server is points
					// scale based on unit preferences
					var con = null;
					var dxfFlag = false;
					if(ext.toLowerCase() == '.dxf'){
						//var unit = config.getSync('units');
						con = Number(config.getSync('dxfImportScale'));
						dxfFlag = true;
						console.log('con', con);
						
						/*if(unit == 'inch'){
							con = 72;
						}
						else{
							// mm
							con = 2.83465;
						}*/
					}
					
					// dirpath is used for loading images embedded in svg files
					// converted svgs will not have images
					importData(body, filename, null, con, dxfFlag);
				}
			}
		});
		var form = req.form();
		form.append('format', 'svg');
		form.append('fileUpload', fs.createReadStream(fileName[0]));
	}
}

function readFile(file){
	
	var ext = path.extname(file.name);
	var filename = uuidv4();
	filename =  uuidv4()+ext;
	filename =  file.name;
	filePath = __dirname+'/files/'+filename;
	fileStr = file.data.toString('utf8');
	fs.writeFileSync(filePath, fileStr);
	return {dirpath:path.dirname(filePath), fileStr:fileStr};
	fs.createReadStream(file.data, 'utf-8', function (err, data) {
		  if(err){
			  console.log( err.message);
			//   message("An error ocurred reading the file :" + err.message, true);
			//   return;
		  }
		//   var filename = path.basename(filepath);
		//   var dirpath = path.dirname(filepath);
		  
		//   importData(file.data, file.name, null, null);
	});
	// importData(file.data, file.name, null, null);
};

app.listen(port);
console.log('Server started at http://localhost:' + port);