process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const env = require('dotenv').config().parsed;  
const path = require('path');
var async = require("async");
// const { ipcRenderer } = require('electron'); 
const fs = require('graceful-fs');
const request = require('request');
const http = require('http');
const url = require('url')
var requestSync = require('sync-request');
const streamifier = require('streamifier');
const AWS = require('aws-sdk');
AWS.config.update({
	region: env.S3_region,
	apiVersion: env.S3_apiVersion,
	credentials: {
	  accessKeyId: env.S3_accessKeyId,
	  secretAccessKey: env.S3_secretAccessKey,
	}
})

var bodyParser = require('body-parser');

const app = express();
const fileUpload = require("express-fileupload");


app.use(fileUpload());
app.use(bodyParser.json({limit: '50mb', extended: true}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// const uuidv4 = require('uuid/v4'); 
var uuid = require('uuid');

const port = process.env.PORT || 3100;
const addon = require('./minkowski/Release/addon');
// const addon = require('./build2/Release/addon');

const PDFDocument = require("pdfkit")
const SVGtoPDF = require("svg-to-pdfkit")
const window = require("svgdom")
const document = window.document
const constants = require("./constants.json");
// const SVG = require("svg.js")(window)
// Add headers before the routes are defined


app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Pass to next layer of middleware
    next();
});


app.on('ready', () => {
  mainWindow = new BrowserWindow({
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
      }
  });
});

app.use(express.static(path.join(__dirname, 'main')));
app.use(express.static('files'))

// sendFile will go here
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/main/index2.html'));
});
app.get('/constants.json', function(req, res) {
	res.send(constants);
});

app.get('/aws', function(req, res) {
		s3 = new AWS.S3();
		var bucketParams = {
			Bucket : 'jitorder-dev'
		  };
		  
		  // call S3 to create the bucket
		  s3.getBucketAcl(bucketParams, function(err, data) {
			if (err) {
			  console.log("Error", err);
			} else if (data) {
			  console.log("Success", data.Grants);
			}
		  });
});


function addSheet(width, height, count) {

	var units = "mm";
	var conversion = config.getSync('scale');

	// remember, scale is stored in units/inch
	if (units == 'mm') {
		conversion /= 25.4;
	}

	var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	rect.setAttribute('x', 0);
	rect.setAttribute('y', 0);
	rect.setAttribute('width', width * conversion);
	rect.setAttribute('height', height * conversion);
	svg.appendChild(rect);
	DeepNest.importsvg(null, null, (new XMLSerializer()).serializeToString(svg));

	DeepNest.parts[DeepNest.parts.length - 1].sheet = true;
	DeepNest.parts[DeepNest.parts.length - 1].quantity = count;

}



app.post('/nest', function(req, res){
	// addSheet(200,1000, 1); 
	// data = ['hi'];
	// res.end(JSON.stringify(req));

	const doc = new PDFDocument({
		layout: "landscape",
		size: "A4"
	  })
	
	  const draw = SVG(document.documentElement)
	
	  const nameSVG = draw
		.text('test')
		.size(45)
		.attr("x", "50%")
		.attr("y", "45%")
		.attr("text-anchor", "middle")
	
	  const dateSVG = draw
		.text('test1')
		.size(19)
		.attr("x", "13.9%")
		.attr("y", "87.7%")
	
	  SVGtoPDF(doc, background)
	  SVGtoPDF(doc, nameSVG.svg())
	  SVGtoPDF(doc, dateSVG.svg())
	
	  doc.pipe(res)
	  doc.end()
})


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

app.post('/writefile', async function(req, res) {	

		try {
						
	if(req.body.type=='svg'){
	  	data = writeFileCust('svg', req)
		res.end(JSON.stringify(data));
	}else if(req.body.type=='pdf'){
		data = writeFileCust('pdf', req)
		res.end(JSON.stringify(data));
	}else if(req.body.type=='dxf'){
		var fileName = uuid.v4();
		fileName = fileName+'.dxf';
		var postreq =  request.post('http://convert.deepnest.io', function (err, resp, body) {
			if (err) {
				msg = 'could not contact file conversion server';
			} else {
				if(body.substring(0, 5) == 'error'){
					msg = body;
				}else{
					var fs = require('fs');
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
		form.append('fileUpload', req.body.dxfFileData, {
		  filename: 'deepnest.svg',
		  contentType: 'image/svg+xml'
		});
		
	}else if(req.body.type=='exportall'){
		var fileName = uuid.v4();
		if(typeof req.body.skuname != 'undefined' && req.body.skuname != null){
			var tm = new Date().toLocaleString("sv-SE", {timeZone:
				"Asia/Kolkata"});
			fileName = req.body.skuname+'_'+tm;
			fileName = fileName.replace(/ /g, "_");
            fileName = fileName.replace(/:/g, "-");
		}
		svgdata = writeFileCust('svg', req, fileName)
		pdfdata = writeFileCust('pdf', req, fileName)
	
		
		// var uploadParams = {Bucket: 'jitorder-dev', Key: '', Body: ''};
		var fs = require('fs');

		
		s3 = new AWS.S3();
		uploadParams = [];
	

		
		fileName = fileName+'.dxf';
		var postreq =  request.post('http://convert.deepnest.io', async function (err, resp, body) {
			if (err) {
				msg = 'could not contact file conversion server';
			} else {
				if(body.substring(0, 5) == 'error'){
					msg = body;
				}
				else{
					fs.writeFileSync('./files/dxf/'+fileName, body);
					dxfdata = {
						url:"http://"+req.get('host')+'/dxf/'+fileName,
						filename:fileName
					};
					
					var sendData = {
						batch_id:req.body.batchid,
						batch_data:req.body.batchData
					}

					var svg = './files/svg/'+svgdata.filename;
					var svgStream = fs.createReadStream(svg);
					uploadParams.push({'body':svgStream, 'id':path.basename(svg), 'type':'svg'});
			
					var pdf = './files/pdf/'+pdfdata.filename;
					var pdfStream = fs.createReadStream(pdf);
					uploadParams.push({'body':pdfStream, 'id':path.basename(pdf), 'type':'pdf'});

					var dxf = './files/dxf/'+dxfdata.filename;
					var dxfStream = fs.createReadStream(dxf);
					uploadParams.push({'body':dxfStream, 'id':path.basename(dxf), 'type':'dxf'});
			
					var mfiles = [{batch_id:req.body.batchid}];
					for (const file of uploadParams) {
						const params = {
							Bucket: 'jitorder-dev',
							Key: file.id,
							Body: file.body,
							ACL: 'public-read',
						};
						try {
							const stored = await s3.upload(params).promise()
							sendData[file.type] = {'type' : file.type, 'url':stored.Location};
							// data[file.type] = {'type' : file.type, 'url':'stored.Location'};
						} catch (err) {

							res.end(JSON.stringify({'status':0, 'message':'unable to upload files nested files.'}));
						}
					}
					fs.unlink(svg, (error) => {
						// console.log(error);
					}); 
					fs.unlink(pdf, (error) => {
						// console.log(error);
					});
					fs.unlink(dxf, (error) => {
						// console.log(error);
					});
					fs.readdirSync('./files/').forEach(file => {
						if(!['svg', 'dxf', 'pdf', null, 'null'].includes(file)){
							fs.unlink('./files/'+file, (error) => {
								// console.log(error);
							});
						}
					});
					let returnedB64 =  requestSync('POST', constants.api+'sync_batch_files/'+req.body.batchid, {json:sendData});
					try {
						res.end(JSON.stringify(JSON.parse(returnedB64.getBody('utf8'))));
					  } catch (e) {	
						res.end(JSON.stringify({'status':0, 'message':'Server Error'}));
					  }
					
				}
			}
		});
		var form = postreq.form();
		form.append('format', 'dxf');
		form.append('fileUpload', req.body.dxfFileData, {
		  filename: 'deepnest.svg',
		  contentType: 'image/svg+xml'
		});
		
	}


	} catch (e) {	
		console.log(e);
		res.end(JSON.stringify({'status':0, 'message':'Server Error'}));
	}

});

function upload(array) {
	s3 = new AWS.S3();
    async.eachSeries(array, function(item, cb) {
        var params = {Bucket : 'jitorder-dev', Key: item.id, Body: item.body};
        s3.upload(params, function(err, data) {
            if (err) {
              console.log("Error uploading data. ", err);
              cb(err)
            } else {
              console.log("Success uploading data");
              cb()
            }
        })
    }, function(err) {
        if (err) console.log('one of the uploads failed')
        else console.log('all files uploaded')
    })
}
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
app.post('/importfrombatch', (req, res) => {
	var data = [];
	var datafiles = [];
	var identifiers = [];
	try {
	if(Array.isArray(req.body.importFiles)){
		datafiles = req.body.importFiles;
		identifiers = req.body.importRef;
	}else{
		datafiles.push(req.body.importFiles);
		identifiers.push(req.body.importRef);
	}		
	var promiseArray = [];
	
		for(var i = 0; i<datafiles.length; i++){

			var file = datafiles[i];
			var identifier = identifiers[i];
			var ext = path.extname(file);
			var filename = path.basename(file);
	
			if(ext.toLowerCase() == '.svg'){
				var filename = uuid.v4()+ext;
				filePath = __dirname+'/files/'+filename;
				let returnedB64 =  requestSync('GET', file);
				let bufferData = returnedB64.getBody();
				let stringData = bufferData.toString();
				// fileStr = file.data.toString('utf8');
				fs.writeFileSync(filePath, stringData);
				// console.log(); return;
				// readFileData = readFile(filePath);
				// var fdata =  {data:readFileData.fileStr, name:file.name, dirpath:readFileData.dirpath, scalingFactor:null }
	
				// var file = fs.readFileSync(filePath, 'utf8');
				// console.log(file);
				// readFileData =  {dirpath:filePath, fileStr:file.toString()};
				var fdata =  {data:stringData, name:filename, dirpath:__dirname+'/files/', scalingFactor:null, identifier:identifier }
				data.push(fdata);
			}else{
				//svg is supported for now
			}
	
		}	
	} catch (err) {
		return res.end(JSON.stringify({'status':0, 'message':'unable to process files.'}));
	}
	if(data.length > 0){
		res.end(JSON.stringify(data));
	}else{
		return res.end(JSON.stringify({'status':0, 'message':'No files were processed.'}));
	}
	
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
	var filename = uuid.v4();
	filename =  uuid.v4()+ext;
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


function writeFileCust(type, req){
	var fileName = uuid.v4();
	if(typeof req.body.skuname != 'undefined' && req.body.skuname != null){
		var tm = new Date().toLocaleString("sv-SE", {timeZone:
			"Asia/Kolkata"});
		fileName = req.body.skuname+'_'+tm;
		fileName = fileName.replace(/ /g, "_");
		fileName = fileName.replace(/:/g, "-");
	}
	if(type=='svg'){
	  	fileName = fileName+'.svg';
		let dir = './files/svg/';
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir);
		}
		fs.writeFileSync(dir+fileName, req.body.filedata);
		data = {
			url:"http://"+req.get('host')+'/svg/'+fileName,
			filename:fileName
		};
		return data;
	}else if(type=='pdf'){
		fileName = fileName+'.pdf';
		let dir = './files/pdf/';
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir);
		}
		const doc = new PDFDocument();
	  	doc.pipe(fs.createWriteStream(dir+fileName));
		PDFDocument.prototype.addSVG = function(svg, x, y, options) {
			return SVGtoPDF(this, svg, x, y, options), this;
		};
		let width = 420;
		let height =  800;
		doc.addSVG(req.body.filedata, 0,0, {
			width,
			height,
			preserveAspectRatio: `${width}x${height}`,
		  });
		doc.end();
		data = {
			url:"http://"+req.get('host')+'/pdf/'+fileName,
			filename:fileName
		};
		return data;
	}else if(type=='dxf'){
		fileName = fileName+'.dxf';
		var postreq = request.post('http://convert.deepnest.io', function (err, resp, body) {
			if (err) {
				msg = 'could not contact file conversion server';
			} else {
				if(body.substring(0, 5) == 'error'){
					msg = body;
				}
				else{
					let dir = './files/dxf/';
					if (!fs.existsSync(dir)){
						fs.mkdirSync(dir);
					}
					fs.writeFileSync(dir+fileName, body);
					data = {
						url:"http://"+req.get('host')+'/dxf/'+fileName,
						filename:fileName
					};
					return data;
				}
			}
		});
		var form = postreq.form();
		form.append('format', 'dxf');
		form.append('fileUpload', req.body.dxfFileData, {
		  filename: 'deepnest.svg',
		  contentType: 'image/svg+xml'
		});
	}

}

app.listen(port);
// console.log('Server started at http://52.4.107.14:' + port);
console.log('Server started at http://localhost:' + port);