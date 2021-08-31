const express = require('express');
const path = require('path');

// const { ipcRenderer } = require('electron'); 
const fs = require('graceful-fs');
const request = require('request');
const http = require('http');
const url = require('url')
const streamifier = require('streamifier');
var bodyParser = require('body-parser');

const app = express();
const fileUpload = require("express-fileupload");
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const uuidv4 = require('uuid/v4'); 
const port = process.env.PORT || 8080;
const addon = require('./minkowski/Release/addon');
// const addon = require('./build2/Release/addon');


app.on('ready', () => {
  mainWindow = new BrowserWindow({
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
      }
  });
});

// app.use(function(req, res, next) {
//     var origin = req.headers.origin;
//     res.header("Access-Control-Allow-Origin", origin); 
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     res.header("Access-Control-Allow-Credentials", "true");
//     next();
//   });
  
app.use(express.static(path.join(__dirname, 'main')));
app.use(express.static('files'))

// sendFile will go here
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/main/index2.html'));
});


// sendFile will go here
app.post('/calculatenfp', function(req, res) {
	var A = req.body.A;
	A.children = req.body.Achildren;
	A.rotation = req.body.Arotation;
	A.source = req.body.Asource;
	var B = req.body.B;
	B.rotation = req.body.Brotation;
	B.source = req.body.Bsource;
	nfp = addon.calculateNFP({A: A, B: B});
	data = {
		nfp:nfp,
		nfpChildren:nfp[0].children
	}
	// console.log();
	// console.log(JSON.stringify(data));
	// console.log(JSON.stringify(nfp));
	// res.end(nfp);
	res.end(JSON.stringify(data));
});

app.post('/writefile', function(req, res) {
	var fileName = uuidv4();
	
	if(req.body.type=='svg'){
		fileName = fileName+'.svg';
		fs.writeFileSync('./files/svg/'+fileName, req.body.filedata);
		data = {
			url:"http://"+req.get('host')+'/svg/'+fileName,
			filename:fileName
		};
		res.end(JSON.stringify(data));
	}else if(req.body.type=='dxf'){
		fileName = fileName+'.dxf';
		var postreq = request.post('http://convert.deepnest.io', function (err, resp, body) {
			if (err) {
				msg = 'could not contact file conversion server';
			} else {
				if(body.substring(0, 5) == 'error'){
					msg = body;
				}
				else{
					fs.writeFileSync('./files/dxf/'+fileName, body);
					data = {
						url:"http://"+req.get('host')+'/dxf/'+fileName,
						filename:fileName
					};
					res.end(JSON.stringify(data));
				}
			}
		});
		var form = postreq.form();
		form.append('format', 'dxf');
		form.append('fileUpload', req.body.filedata, {
		  filename: 'deepnest.svg',
		  contentType: 'image/svg+xml'
		});
	}
});

app.post('/import', (req, res) => {
	var data = [];
	var datafiles = [];
	if(Array.isArray(req.files.importFiles)){
		datafiles = req.files.importFiles;
	}else{
		datafiles.push(req.files.importFiles);
	}		
	var promiseArray = [];
	for(var i = 0; i<datafiles.length; i++){
	
		var file = datafiles[i];
		var ext = path.extname(file.name);
		var filename = path.basename(file.name);
	
		if(ext.toLowerCase() == '.svg'){
			readFileData = readFile(file);
			var fdata =  {data:readFileData.fileStr, name:file.name, dirpath:readFileData.dirpath, scalingFactor:null }
			data.push(fdata);
		}else{

			// readFileData = readFile(file);
			// var url = 'http://convert.deepnest.io';

			// var req = request.post(url, function (err, resp, body) {
			// 	if (err) {
				
			// 	} else {
			// 		if(body.substring(0, 5) == 'error'){
			// 			// console.log(body);
			// 		}
			// 		else{
			// 			// expected input dimensions on server is points
			// 			// scale based on unit preferences
			// 			var con = null;
			// 			var dxfFlag = false;
			// 			if(ext.toLowerCase() == '.dxf'){
			// 				//var unit = config.getSync('units');
			// 				con = Number("1");
			// 				dxfFlag = true;
			// 				// console.log('con', con);
							
			// 				/*if(unit == 'inch'){
			// 					con = 72;
			// 				}
			// 				else{
			// 					// mm
			// 					con = 2.83465;
			// 				}*/
			// 			}
						
			// 			// dirpath is used for loading images embedded in svg files
			// 			// converted svgs will not have images
			// 			// console.log({data:body, name:filename, dirpath:null, scalingFactor:con, dxfFlag:dxfFlag });
			// 			fdata =  {data:body, name:filename, dirpath:null, scalingFactor:con, dxfFlag:dxfFlag }
				
			// 		}
			// 	}
				
			// var form = req.form();
			// form.append('format', 'svg');
			// // streamifier.streamifier.createReadStream(file.data).pipe(process.stdout);
			// form.append('fileUpload', fs.createReadStream(readFileData.dirpath+'/'+file.name));
			
			// })
			
		}

	}
	

	res.end(JSON.stringify(data));
});

function processFile(file){
	var ext = path.extname(file.name);
	var filename = path.basename(file.name);
	if(ext.toLowerCase() == '.svg'){
		readFileData = readFile(file);
		return {data:readFileData.fileStr, name:file.name, dirpath:readFileData.dirpath, scalingFactor:null }
	}else{
		// send to conversion server
		readFileData = readFile(file);
		var url = 'http://convert.deepnest.io';
		var req = request.post(url, function (err, resp, body) {
			if (err) {
				// console.log(err, true);
			} else {
				if(body.substring(0, 5) == 'error'){
					// console.log(body);
				}
				else{
					// expected input dimensions on server is points
					// scale based on unit preferences
					var con = null;
					var dxfFlag = false;
					if(ext.toLowerCase() == '.dxf'){
						//var unit = config.getSync('units');
						con = Number("1");
						dxfFlag = true;
						// console.log('con', con);
						
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
					// console.log({data:body, name:filename, dirpath:null, scalingFactor:con, dxfFlag:dxfFlag });
					return {data:body, name:filename, dirpath:null, scalingFactor:con, dxfFlag:dxfFlag }
				}
			}
		});
		var form = req.form();
		form.append('format', 'svg');
		// streamifier.streamifier.createReadStream(file.data).pipe(process.stdout);
		form.append('fileUpload', fs.createReadStream(readFileData.dirpath+'/'+file.name));
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