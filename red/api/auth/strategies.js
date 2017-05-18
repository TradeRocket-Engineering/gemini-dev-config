/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var BearerStrategy = require('passport-http-bearer').Strategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;

var passport = require("passport");
var crypto = require("crypto");
var util = require("util");

var Tokens = require("./tokens");
var Users = require("./users");
var Clients = require("./clients");
var permissions = require("./permissions");
var request = require('request');

var log;
var settings = null;

var bearerStrategy = function (accessToken, done) {
    // is this a valid token?
    Tokens.get(accessToken).then(function(token) {
        util.log("Request is using bearerStrategy")
        if (token) {
            var user = {username: token.user, permissions: token.scope};
            done(null,user,{scope:token.scope});
        } else {
            //kchen - we check if this is a valid token from oauth2 service
            request({
                url: settings.oauth2UserUrl,
                auth: {
                    'bearer': accessToken
                }
            }, function(err, res) {
                if (!res || !res.body) {
                    log.audit({event: "System error.  Please try later"});
                    done(null,false);
                }
                else {
                    //util.log("body: " + res.body);
                    json = JSON.parse(res.body);
                    if (json.length == 0) {
                        log.audit({event: "user is not authenticated"});
                        done(null,false);
                    }
                    else if (json.error) {
                        log.audit({event: json.error_description});
                        done(null,false);
                    }
                    else {
                        var allowView = false;
                        var allowEdit = false;
                        console.dir(json);
                        
                        for (var el in json.authorities) {
                            if (json.authorities[el].authority.indexOf("ROLE_PROGRAMEDIT") !== -1) {
                                allowEdit = true;
                                break;
                            }
                            else if (json.authorities[el].authority.indexOf("ROLE_PROGRAMEXECUTION") !== -1 || json.authorities[el].authority.indexOf("ROLE_PROGRAMVIEW") !== -1) {
                                allowView = true;
                            }
                        }
                        util.log("json: " + json);
                        var username = json.userAuthentication.name;
                        settings.username = json.userAuthentication.name;
                        settings.functionGlobalContext.useremail = json.userAuthentication.name;
                        settings.functionGlobalContext.username = json.userAuthentication.name;
                        //console.dir(settings);
                        var tmp = {};
                        if (allowEdit == true) {                                
                            tmp = {username: username, access_token: accessToken, permissions: "*"};
                            Users.addToken(tmp);
                            Tokens.add(username,"node-red-admin","*",accessToken).then(function(tokens) {
                            });
                            log.audit({event: username + " have all the permissions"});
                            done(null,tmp,{scope:"*"});
                        }
                        else if (allowView == true) {
                            tmp = {username: username, permissions: "read", access_token: accessToken};
                            Users.addToken(tmp);
                            Tokens.add(username,"node-red-admin","read",accessToken).then(function(tokens) {
                            });
                            log.audit({event: username  + " have only read right"});
                            done(null,tmp,{scope:"read"});
                        }
                        else {
                            tmp = {username: username, access_token: accessToken};
                            log.audit({event: username + " is authenticated but has no right"});
                            done(null,false);
                        }
                    }
                }
            });
            
            log.audit({event: "auth.invalid-token"});
            done(null,false);
        }
    });
}
bearerStrategy.BearerStrategy = new BearerStrategy(bearerStrategy);

var clientPasswordStrategy = function(clientId, clientSecret, done) {
    util.log("Request is using clientPasswordStrategy");
    Clients.get(clientId).then(function(client) {
        if (client && client.secret == clientSecret) {
            done(null,client);
        } else {
            log.audit({event: "auth.invalid-client",client:clientId});
            done(null,false);
        }
    });
}
clientPasswordStrategy.ClientPasswordStrategy = new ClientPasswordStrategy(clientPasswordStrategy);

var loginAttempts = [];
var loginSignInWindow = 600000; // 10 minutes


var passwordTokenExchange = function(client, username, password, scope, done) {
    util.log("Request is using passwordTokenExchange");
    var now = Date.now();
    loginAttempts = loginAttempts.filter(function(logEntry) {
        return logEntry.time + loginSignInWindow > now;
    });
    loginAttempts.push({time:now, user:username});
    var attemptCount = 0;
    loginAttempts.forEach(function(logEntry) {
        /* istanbul ignore else */
        if (logEntry.user == username) {
            attemptCount++;
        }
    });
    if (attemptCount > 5) {
        log.audit({event: "auth.login.fail.too-many-attempts",username:username,client:client.id});
        done(new Error("Too many login attempts. Wait 10 minutes and try again"),false);
        return;
    }
    
    Users.authenticate(username,password).then(function(user) {
        if (user) {
            if (scope === "") {
                scope = user.permissions;
            }
            if (permissions.hasPermission(user.permissions,scope)) {
                loginAttempts = loginAttempts.filter(function(logEntry) {
                    return logEntry.user !== username;
                });
                if (!user.access_token) {
                    Tokens.create(username,client.id,scope).then(function(tokens) {
                        log.audit({event: "auth.login",username:username,client:client.id,scope:scope});
                        done(null,tokens.accessToken,null,{expires_in:tokens.expires_in});
                    });
                } else {
                    Tokens.add(username,client.id,scope,user.access_token).then(function(tokens) {
                        log.audit({event: "auth.login",username:username,client:client.id,scope:scope});
                        done(null,tokens.accessToken,null,{expires_in:tokens.expires_in});
                    });                       
                }            
            } else {
                log.audit({event: "auth.login.fail.permissions",username:username,client:client.id,scope:scope});
                done(null,false);
            }
        } else {
            log.audit({event: "auth.login.fail.credentials",username:username,client:client.id,scope:scope});
            done(null,false);
        }
    });
}

function AnonymousStrategy() {
  passport.Strategy.call(this);
  this.name = 'anon';
}
util.inherits(AnonymousStrategy, passport.Strategy);
AnonymousStrategy.prototype.authenticate = function(req) {
    var self = this;
    Users.default().then(function(anon) {
        if (anon) {
            self.success(anon,{scope:anon.permissions});
        } else {
            self.fail(401);
        }
    });
}

module.exports = {
    init: function(runtime) {
        log = runtime.log;
        settings = runtime.settings;
    },
    bearerStrategy: bearerStrategy,
    clientPasswordStrategy: clientPasswordStrategy,
    passwordTokenExchange: passwordTokenExchange,
    anonymousStrategy: new AnonymousStrategy()
}
