/************************************* 
* @project: Instagram Media Uploader *
* @version: 0.1.2 					 *
* @author: deutschlion				 *
**************************************/
// USE IT FOR YOUR OWN RISK

// require modules
var request	= require('request');
var fs 		= require('fs');
var _ 		= require('lodash');
var uuid 	= require('node-uuid');
var crypto 	= require('crypto');
var path 	= require('path');
var qs		= require('querystring');
var tough 	= require('tough-cookie');

// config & global vars
var _guid = uuid.v4();
var _csrf = '';
var _ts = '';
var config = {
	username: 'florentina.88',		// Set username
	password: 'aeH3WEMi',			// Set password
	filename: 'img/demo.jpg', 		// Set the path to the file that you wish to post.
									// This must be jpeg format and it must be a perfect square
	caption: "Test caption", 		// Set the caption for the photo
	useragent: "Instagram 6.15.0 Android (21/5.0.2; 480dpi; 1080x1776; LGE/Google; Nexus 5; hammerhead; hammerhead; en_US)",	
									// Define the user agent
	guid: _guid, 					// Define the GuID
	device_id: 	"android-"+_guid	// Set the devide ID
};

// set defaults for request
var baseRequest = request.defaults({
	baseUrl: "http://instagram.com/api/v1/", //'https://instagram.com/api/v1/', // 'http://localhost:8889/'
	followAllRedirects: true,
	headers: {
		'User-Agent': config.useragent,
	},
	jar: true
});

// functions
function signData(data) {
	var sharedSecret = "6d51fe001d37fae892bfd51b334cf2deaa66dc8822ff37e8d0f45e8883d56061";
	var buffer = new Buffer(data, "utf-8");
	var hash = crypto.createHmac("sha256", sharedSecret).update(buffer).digest("hex");
	//
	var result = hash+'.'+data;
	console.log('\n [i] Signed data: '+result);
	return result;
}

function getPostData(filename) {
	if(!fs.existsSync(filename)){
		console.error("\r [!] The image doesn't exist "+filename)
		return false;
	}

	_ts = (new Date).getTime();
	return {
		device_timestamp: _ts,
		photo: fs.createReadStream(filename)
	}
}

function processCSRF(response){
	var _raw 	= response.headers['set-cookie']
	var regexp 	= new RegExp("(?:^" + "csrftoken" + "|;\\s*"+ "csrftoken" + ")=(.*?)(?:;|$)", "g");
	var result 	= regexp.exec(_raw);
	_csrf = (result === null) ? null : result[1];
	if(_csrf !== null){
		console.log("\n [i] CSRF token set: "+_csrf);
		return true;
	}
	else {
		console.error('\r [!] CSRF prosess failed');
    	return false;
	}
	
}

// app
	var g = uuid.v4();
	var opts = { url: 'si/fetch_headers/?challenge_type=signup&guid='+g.replace(/-/g , '')};

// let's start from fetching headers
baseRequest.get(opts, function (error, response, body) {
    if(!error){
    	if(processCSRF(response)){

    		// 
			var data = {
				"username": config.username,
				"password": config.password,
				"device_id": config.device_id,
				"guid": config.guid,
				"csrftoken": _csrf
			}
			,sig = signData(JSON.stringify(data))
			,signed_data = { 
				ig_sig_key_version: 4,
				signed_body: sig
			}

			// do login
			var options = { url: 'accounts/login/', form: signed_data };
			baseRequest.post(options, function(err, response, body) {
			  	if (err) {
			    	console.error('\r [!] Login request failed:', err);
			    	return false;
			  	}
				console.log('\n # Login successful!  Server responded with:', [response.statusCode,body]);

				if(response.statusCode == 200){

					// parse login response
					var login_response = JSON.parse(body);
					if(login_response.status == "ok" && processCSRF(response)){

						// make post data
						var data = getPostData(config.filename);

						if(data){	
						// file exist and we can start uploading

							// upload media
							var options = { url: 'media/upload/', formData: data };
							baseRequest.post(options, function(err, response, body) {
								if(err){
									console.error('\r [!] Image upload failed:', err);
			    					return false;
								}
								console.log('\n # Image upload successful!  Server responded with:', [response.statusCode,body]);

								// parse upload response
								var upload_response = JSON.parse(body);
								if(upload_response.status == "ok" && processCSRF(response)){

									var config_data = {
										caption: config.caption,
										media_id: upload_response.media_id,
										device_timestamp: _ts,
										source_type: 4,
										filter_type: 0,
										device: {
										 	manufacturer: 'LGE',
											model: 'Nexus 5',
											android_version: 21,
											android_release: '5.0.2'
										}
									};

									var sig = signData(JSON.stringify(config_data));
									var signed_data = { 
										ig_sig_key_version: 4,
										signed_body: sig
									};

									// configure media
									var options = { url: 'media/configure/', form: signed_data };
									baseRequest.post(options, function(err, response, body) {
										if(err){
											console.error('\r [!] Image configure failed:', err);
			    							return false;
										}

										// parse config response
										var config_response = JSON.parse(body);
										if(config_response.status == "ok" && processCSRF(response)){
											console.log('\n # Image configure successful!  Server responded with:', config_response);
											console.log('\n # Success! Image posted - [OK]');
										}
										else {
											console.error('\r [!] Config failed. Server resonded with:'+config_response);
											return false;
										}

									});
								}
								else {
									console.error('\r [!] Upload failed. Server resonded with:'+[upload_response.status,upload_response]);
									return false;
								}

							});
						}
						else {
							console.error('\r [!] Make post data failed');
							return false;
						}
					}
					else {
						console.error('\r [!] Login failed. Server resonded with:'+[login_response.status,login_response]);
						return false;
					}
				}
				else {
					console.error('\r [!] Login failed. Server responded with:'+[response.statusCode,body]);
					return false;
				}
			});
    	}
    	else {
    		return false;
    	}
    }
    else {
    	console.error('\r [!] Prelogin failed: '+error);
    	return false;
    }
});

// end