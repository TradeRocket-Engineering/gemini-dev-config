// please change the following three parameters according to the environment related to 
// this instance of program-editor
// this is the base url for oauth server this instance of program-editor will authenticate/authorize with
var auth_base_url = "http://localhost:9080/tr";
// this is the client id for this instance to authenticate with oauth server
var clientId = 'trclient';
// this is the corresponding password for the above client id
var clientPwd = 'trclientpassword';

var when = require("when");
var util = require("util");
var request = require('request');
var userToken = [];
var jwt_tokens = [];
 
module.exports = {
    type: "credentials",
    users: function(username){
        //returns a promise that checks the authorisation for a given user
        return when.promise(function(resolve) {
            util.log(username + " entering users function");
            //util.log(userToken);         
            var hasRight = false;
            for (var el in userToken) {
                if (userToken[el][username]) {
                    resolve({username: username, permissions: userToken[el][username]});
                    util.log(username + " has " + userToken[el][username] + " permission");
                    hasRight = true; 
                    break;
                }
            } 
	        if (hasRight == false) {
                util.log(username + " has no access permission");
                resolve(null);
            }
        });
    },
    authenticate: function(username, password) {
        //returns a promise that completes when the user has been authenticated
        return when.promise(function(resolve) {
            util.log(username + " entering authenticate function");
            var json = {};
            util.log("step1");
            request({
                url: auth_base_url + '/oauth/token',
                method: 'POST',
                auth: {
                    user: clientId,
                    pass: clientPwd
                },
                form: {
                    username: username,
                    password: password,
                    grant_type: 'password',
                    scope: 'openid'             
                }
            }, function(err, res) {
                if (!res || !res.body) {
                    resolve(null);
                    util.log("System error.  Please try later");
                    return;
                }
                json = JSON.parse(res.body);
                //util.log(json);
                if (json.length == 0 || !json.access_token) {
                    util.log(username + " is not authenticated");
                    resolve(null);
                }
                else if (json.access_token) {
                    var access_token = json.access_token;
                    //util.log(json.access_token);
                    request({
                        url: auth_base_url + '/user',
                        auth: {
                            'bearer': json.access_token
                        }
                    }, function(err, res) {
                        if (!res || !res.body) {
                            resolve(null);
                            util.log("System error.  Please try later");
                        }
                        else {
                            json = JSON.parse(res.body);
                            if (json.length == 0) {
                                resolve(null);
                                util.log(username + " is not authenticated");
                            }
                            else {
                                var allowView = false;
                                var allowEdit = false;
             
                                // remove the previous user from the cached userToken array
                                for (var i in userToken) {
                                    if (userToken[i][username]) {
                                        userToken.splice(i, 1);
                                        break;
                                    }
                                }
                                for (var j in jwt_tokens) {
                                    if (jwt_tokens[j][username]) {
                                        jwt_tokens.splice(j, 1);
                                        break;
                                    }
                                }

                                for (var el in json.authorities) {
                                    if (json.authorities[el].authority.indexOf("ROLE_PROGRAMEDIT") !== -1) {
                                        allowEdit = true;
                                        break;
                                    }
                                    else if (json.authorities[el].authority.indexOf("ROLE_PROGRAMEXECUTION") !== -1 ||          json.authorities[el].authority.indexOf("ROLE_PROGRAMVIEW") !== -1) {
                                        allowView = true;
                                    }
                                }
                                var token = {};
                                token[username] = access_token;
                                jwt_tokens.push(token);
                                if (allowEdit == true) {
                                    var keyval = {};
                                    keyval[username] = "*";
                                    userToken.push(keyval);                                 
                                    var tmp = {username: username, access_token: access_token, permissions: "*"};
                                    resolve(tmp);
                                    util.log(username + " have all the permissions");
                                }
                                else if (allowView == true) {
                                    var keyval = {};
                                    keyval[username] = "read";
                                    userToken.push(keyval);
                                    resolve({username: username, permissions: "read", access_token: access_token});
                                    util.log(username + " have only read right");
                                }
                                else {
                                    resolve(null);
                                    util.log(username + " is authenticated but has no right");
                                }
                            };
                        };
                    });
                }
            });
        });
    },
    default: function() {
        // Resolve with the user object for the default user.
        // If no default user exists, resolve with null.
        return when.promise(function(resolve) {
            resolve(null);
        });
    },
    retrieveToken: function(username){
        //returns a promise that checks the authorisation for a given user
        return when.promise(function(resolve) {
            util.log(username + " entering retrieveToken function");
            util.log("number of jwt_tokens: " + jwt_tokens.length);
            util.log("jwt_tokens: " + jwt_tokens);
            //util.log(userToken);         
            var hasRight = false;
            for (var el in jwt_tokens) {
                util.log(username + ": " + jwt_tokens[el]);
                util.log(username + " token: " + jwt_tokens[el][username]);
                if (jwt_tokens[el][username]) {
                    resolve(jwt_tokens[el][username]);
                    util.log(username + " has access token in store");
                    hasRight = true; 
                    break;
                }
            } 
	        if (hasRight == false) {
                util.log(username + " has no access token in store");
                resolve(null);
            }
        });
    },
    addToken: function(user){
        //returns a promise that checks the authorisation for a given user
        return when.promise(function(resolve) {
            util.log("user: " + user);
            var token = {};
            token[user.username] = user.access_token;
            jwt_tokens.push(token);

            if (user.permissions) {
                var keyval = {};
                keyval[user.username] = user.permissions;
                userToken.push(keyval);
            }
            resolve(user);
        });
    }
};
