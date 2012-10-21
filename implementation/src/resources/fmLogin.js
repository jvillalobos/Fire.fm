/**
 * Copyright (c) 2010, Jose Enrique Bolanos, Jorge Villalobos
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *  * Neither the name of Jose Enrique Bolanos, Jorge Villalobos nor the names
 *    of its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
 * OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmSecret.js");

// The data used to store and retrieve the Last.fm API session key.
const API_SESSION_LOGIN_HOST = "chrome://firefm";
const API_SESSION_LOGIN_REALM = "Last.fm Web Services";

/**
 * Handles the authentication against the Last.fm API, and the fetching of
 * playlists.
 */
FireFM.Login = {
  // Topic notifications sent from this object.
  get TOPIC_USER_AUTHENTICATION() { return "firefm-user-authentication"; },

  /* Logger for this object. */
  _logger : null,
  /* Login Manager service reference. */
  _loginManager : null,
  /* The name of the currently logged in user. */
  _userName : null,
  /* List of stored user names. */
  _userList : [],
  /* The api session of the currently logged in user. */
  _apiSession : null,

  /**
   * Initializes this object.
   */
  init : function() {
    let that = this;

    this._logger = FireFM.getLogger("FireFM.Login");
    this._logger.debug("init");

    this._loginManager =
      Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
    this._beginLogin(true);
  },

  /**
   * Gets the user name of the currently logged in user.
   * @return the user name of the currently logged in user. null if no user is
   * online.
   */
  get userName() { return this._userName; },

  /**
   * Gets the list of users stored in the login manager.
   * @return the list of users stored in the login manager.
   */
  get userList() { return this._userList; },

  /**
   * Get the API session key for the currently logged in user.
   * @return the API session key for the currently logged in user. null if no
   * user is logged in or no key is stored for this user.
   */
  get apiSession() {
    this._logger.debug("[getter] apiSession");

    return this._apiSession;
  },

  /**
   * Adds a new user to the list.
   * @param aUserName The user name of the last.fm account.
   * @param aApiSession The API session key for the user.
   */
  addUser : function(aUserName, aApiSession) {
    this._logger.debug("addUser");

    let nsLoginInfo =
      new Components.Constructor(
        "@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo, "init");
    let loginObj =
      new nsLoginInfo(
        API_SESSION_LOGIN_HOST, null, API_SESSION_LOGIN_REALM, aUserName,
        aApiSession, "", "");

    try {
      // check if the user is already there.
      let match = this._getLogins(aUserName);

      if (null == match) {
        this._loginManager.addLogin(loginObj);
      } else{
        this._logger.warn("addUser. Overwriting old login.");

        let oldLoginObj =
          new nsLoginInfo(
            API_SESSION_LOGIN_HOST, null, API_SESSION_LOGIN_REALM, aUserName,
            match, "", "");

        this._loginManager.modifyLogin(oldLoginObj, loginObj);
      }

      // Refresh the user list
      this._getLogins("");
    } catch (e) {
      this._logger.warn(
        "addUser. Error setting user info.\n" + e);
    }
  },

  /**
   * Removes an existing user from the list.
   * @param aUserName The user name of the last.fm account.
   */
  removeUser : function(aUserName) {
    this._logger.debug("removeUser");

    try {
      let logins = this._loginManager.findLogins(
        {}, API_SESSION_LOGIN_HOST, null, API_SESSION_LOGIN_REALM);

      for (let i = 0; i < logins.length; i++) {
        if (logins[i].username == aUserName) {

          // Remove the user session
          this._loginManager.removeLogin(logins[i]);
          // Refresh the user list
          this._getLogins("");
          // If the user signed in, do sign out
          if (this.userName == aUserName)
            this.logout();

          break;
        }
      }
    }
    catch (e) {
      this._logger.warn("removeUser. Error removing user.\n" + e);
    }
  },

  /**
   * Logs in the given user. This user must already have an API session stored
   * in the Login Manager.
   * @param aUserName the username.
   */
  login : function(aUserName) {
    this._logger.debug("login");

    if ((null != aUserName) && (0 < aUserName.length)) {
      if (null != this.userName) {
        this._logger.debug("login. Somebody is logged in already.");
        this.logout();
      }

      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "lastUser").value =
        aUserName;
      this._beginLogin();
    } else {
      this._logger.error("login. Invalid user name.");
    }
  },

  /**
   * Logs the user out.
   */
  logout : function() {
    this._logger.debug("logout");
    this._userName = null;
    this._apiSession = null;
    FireFM.obsService.notifyObservers(
      null, this.TOPIC_USER_AUTHENTICATION, null);
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "lastUser").value = "";
  },

  /**
   * Begins the login process for the extension.
   * @param aIsStartup indicates if this is being run at startup.
   */
  _beginLogin : function(aIsStartup) {
    this._logger.trace("_beginLogin");

    let lastUser =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "lastUser").value;
    let apiSession = this._getLogins(lastUser);

    if (null != apiSession) {
      this._userName = lastUser;
      this._apiSession = apiSession;

      // XXX: only load these components when necessary.
      this._loadModules();

      FireFM.obsService.notifyObservers(
        null, this.TOPIC_USER_AUTHENTICATION, this._userName);
      // request a Scrobble session.
      FireFM.Remote.scrobbleHandshake();
    } else {
      this._userName = null;
      this._apiSession = null;
      // XXX: the player throws an error if we try to stop it at startup.
      if (!aIsStartup) {
        FireFM.obsService.notifyObservers(
          null, this.TOPIC_USER_AUTHENTICATION, null);
      }
    }
  },

  /**
   * Gets all login information related to this add-on.
   * @param aUserName a specific user we need the session for. Can be empty.
   */
  _getLogins : function (aUserName) {
    this._logger.trace("_getLogins");

    let userLower = aUserName.toLowerCase();
    let apiSession = null;
    let loginObjs = [];
    let loginCount;
    let loginName;

    try {
      loginObjs =
        this._loginManager.findLogins(
          {}, API_SESSION_LOGIN_HOST, null, API_SESSION_LOGIN_REALM);
    } catch (e) {
      this._logger.warn("_getLogins. Error getting user info.\n" + e);
    }

    loginCount = loginObjs.length;
    // clear user list.
    this._userList.splice(0, this._userList.length);

    for (let i = 0; i < loginCount; i++) {
      loginName = loginObjs[i].username;
      this._userList.push(loginName);

      if (userLower == loginName.toLowerCase()) {
        this._logger.debug("_getLogins. Session id found.");
        apiSession = loginObjs[i].password;
        // don't break because we need to update the user list.
      }
    }

    return apiSession;
  },

  /**
   * Loads the JS modules required after logging in.
   */
  _loadModules : function() {
    this._logger.trace("_loadModules");

    Components.utils.import("resource://firefm/fmFeeds.js");
    Components.utils.import("resource://firefm/fmNotifier.js");
    Components.utils.import("resource://firefm/fmEntities.js");
    Components.utils.import("resource://firefm/fmStation.js");
  }
};
