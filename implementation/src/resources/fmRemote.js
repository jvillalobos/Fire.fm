/**
 * Copyright (c) 2008-2010, Jose Enrique Bolanos, Jorge Villalobos
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
const Ce = Components.Exception;

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmLogin.js");

// The amount of time necessary before a track can be marked to be Scrobbled.
const SCROBBLE_TIME = 240 * 1000; // 240 seconds.
// The minimum duration a track should have to be Scrobbled.
const SCROBBLE_MIN_DURATION = 30 * 1000; // 30 seconds.

// Last.fm URLs.
const URL_BASE = "http://www.last.fm";
const URL_BASE_SSL = "https://www.last.fm";
const URL_SEARCH = URL_BASE + "/music/?q=";

// API URLs.
const URL_API_20 = "http://ws.audioscrobbler.com/2.0/";
const URL_SCROBBLE_1_2 = "http://post.audioscrobbler.com:80/";

// Preference value to allow third party cookies.
const COOKIES_ALLOW_THIRD_PARTY = 0;

/**
 * Handles most of the communication with the Last.FM API. See FireFM.Login for
 * other site interactions.
 */
FireFM.Remote = {
  // Topic notifications sent from this object.
  get TOPIC_TRACK_LOVED() { return "firefm-track-loved"; },

  /* Home URL. */
  get URL_HOME() { return URL_BASE; },
  /* Scrobble Help URL. */
  get URL_SCROBBLE_HELP() {
    return "http://firefm.sourceforge.net/help/#scrobbling"; },
  /* Mouse gestures Help URL. */
  get URL_GESTURES_HELP() {
    return "http://firefm.sourceforge.net/help/#gestures"; },

  // Tag type constants
  get TAG_TYPE_ARTIST() { return 0; },
  get TAG_TYPE_TRACK()  { return 1; },
  get TAG_TYPE_ALBUM()  { return 2; },

  /* Login Manager service reference. */
  _loginManager : null,
  /* The cookie behavior preference. */
  _cookieBehaviorPref : null,
  /* The last value of the cookie preference. */
  _lastCookieValue : -1,
  /* Logger for this object. */
  _logger : null,
  /* Scrobble preference object. */
  _scrobblePref : null,
  /* Indicates if Scrobble is currently active. */
  _scrobbleActive : false,
  /* The Scrobble session ID. */
  _scrobbleSessionId : null,
  /* The URL used to send Now Playing information. */
  _scrobbleURLNowPlaying : null,
  /* The URL used to send Scrobble information. */
  _scrobbleURLSubmit : null,
  /* Stored Last.fm logins. It's a user/hash mapping. */
  _lastFMLogins : null,
  /* Holds the next track to be Scrobbled, if any. */
  _toBeScrobbled : null,
  /* Indicates if the current track has been loved or not. */
  _loved : false,
  /* Indicates if the current track has been banned or not. */
  _banned : false,
  /* Indicates if the current track was skipped or not. */
  _skipped : false,

  /**
   * Initializes this object.
   */
  init : function() {
    let that = this;

    this._logger = FireFM.getLogger("FireFM.Remote");
    this._logger.debug("init");

    this._loginManager =
      Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

    // XXX: we need this because we can't add accounts with third party cookies
    // disabled.
    this._cookieBehaviorPref =
      FireFM.Application.prefs.get("network.cookie.cookieBehavior");
    this._scrobblePref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "scrobble");

    // set the current value of the Scrobble preference.
    this._scrobbleActive = (true == this._scrobblePref.value);
    // add preference listener for the Scrobble preference.
    this._scrobblePref.events.addListener("change", this);

    FireFM.obsService.addObserver(
      this, FireFM.Player.TOPIC_TRACK_LOADED, false);
  },

  /**
   * Verifies if the user name and password correspond to a valid Last.fm
   * account by attempting to sign in the user to the last.fm site. First, the
   * sign out page is loaded to ensure no other user is signed in.
   * @param aUserName The user name of the Last.fm account.
   * @param aPassword The passowrd of the Last.fm account.
   * @param aCallback The method to be called when the result is obtained.
   */
  verifyAccount : function(aUserName, aPassword, aCallback) {
    this._logger.debug("verifyAccount");
    // save the state of the cookie preference.
    this._saveCookiePref();
    this._goToEnglishSite(aUserName, aPassword, aCallback);
  },

  /**
   * Force a language change on the Last.fm site, to make sure it's English and
   * we can do the following steps safely.
   * XXX: this really sucks, but so does most of this stuff anyway.
   * @param aUserName The user name of the Last.fm account.
   * @param aPassword The passowrd of the Last.fm account.
   * @param aCallback The method to be called when the result is obtained.
   */
  _goToEnglishSite : function(aUserName, aPassword, aCallback) {
    this._logger.trace("_goToEnglishSite");

    let that = this;
    let logoutFunction = function() {
      // sign out from Last.fm in case it's necessary.
      FireFM.sendRequest(
        URL_BASE + "/login/logout",
        function(aEvent) {
          that._logoutLoad(aEvent, aUserName, aPassword, aCallback); },
        function(aEvent) {
          that._logoutError(aEvent, aUserName, aPassword, aCallback); },
        null, false, null);
    }

    // go to English site.
    FireFM.sendRequest(
      URL_BASE + "/?change=language&setlang=en", logoutFunction, logoutFunction,
      null, false, null);
  },

  /**
   * Load callback handler for the logout call. The logout call may produce a
   * second page with a verification form. This needs to be sent as well, to
   * make sure the user is logged out.
   * @param aEvent The event that triggered this function.
   * @param aUserName The user name of the Last.fm account.
   * @param aPassword The passowrd of the Last.fm account.
   * @param aCallback The method to be called when the result is obtained.
   */
  _logoutLoad : function(aEvent, aUserName, aPassword, aCallback) {
    this._logger.trace("_logoutLoad");

    try {
      // XXX: using an HTML parser here is a little complicated, so we'll have
      // to rely on RE. We're already very dependent on page layout anyway, so
      // it sucks all the way.
      let that = this;
      let inputRE =
        /<input [^>]*name="formtoken" [^>]*value="([^"]*)"[^>]*\/>/i;
      let responseText = String(aEvent.target.responseText);
      let params =
        "formtoken=" + encodeURIComponent(inputRE.exec(responseText)[1]);

      FireFM.sendRequest(
        aEvent.target.channel.URI.spec,
        function(aEvent) {
          that._login(aEvent, aUserName, aPassword, aCallback); },
        function(aEvent) {
          that._logoutError(aEvent, aUserName, aPassword, aCallback); },
        { "Content-Type" : "application/x-www-form-urlencoded" },
        true, params);
    } catch (e) {
      // continue anyway, since we may still be able to authenticate.
      this._login(aEvent, aUserName, aPassword, aCallback);
      this._logger.warn("_logoutLoad. The form page wasn't loaded.\n" + e);
    }
  },

  /**
   * Error callback handler for the logout call.
   * @param aEvent The event that triggered this function.
   * @param aUserName The user name of the Last.fm account.
   * @param aPassword The passowrd of the Last.fm account.
   * @param aCallback The method to be called when the result is obtained.
   */
  _logoutError : function(aEvent, aUserName, aPassword, aCallback) {
    this._logger.warn("_logoutError");

    // log some info we may need.
    try {
      this._logger.warn("_logoutError. status: " + aEvent.target.status);
      this._logger.warn(
        "_logoutError. URL: " + aEvent.target.channel.URI.spec);
      this._logger.warn("_logoutError. Text:\n" + aEvent.target.responseText);
    } catch (e) {
      this._logger.warn("_logoutError\n" + e);
    }

    // continue anyway, since we may still be able to authenticate.
    this._login(aEvent, aUserName, aPassword, aCallback);
  },

  /**
   * Attempts to log in to last.fm using the username and password.
   * @param aEvent The event that triggered this function.
   * @param aUserName The user name of the Last.fm account.
   * @param aPassword The passowrd of the Last.fm account.
   * @param aCallback The method to be called when the result is obtained.
   */
  _login: function(aEvent, aUserName, aPassword, aCallback) {
    this._logger.trace("_login");

    const PARAMS_LOGIN =
      "username=$(USERNAME)&password=$(PASSWORD)&login=&refererKey=";

    let that = this;
    let params = PARAMS_LOGIN;

    // set parameters.
    params = params.replace(/\$\(USERNAME\)/, encodeURIComponent(aUserName));
    params = params.replace(/\$\(PASSWORD\)/, encodeURIComponent(aPassword));

    FireFM.sendRequest(
      URL_BASE_SSL + "/login/",
      function (aEvent) {
        let loggedIn = false;

        try {
          that._resetCookiePref();
          loggedIn = ("/home" == aEvent.target.channel.URI.path);

          if (!loggedIn) {
            that._logger.debug("_login. status: Failed URL validation.");
            // XXX: since this doesn't work every time, look for a link to the
            // user profile.
            let responseText = String(aEvent.target.responseText);

            loggedIn = responseText.match(/<a href=\"\/user\//i);

            if (!loggedIn) {

              that._logger.warn(
                "_login. URL: " + aEvent.target.channel.URI.spec);
              that._logger.warn(
                "_login. Text:\n" + aEvent.target.responseText);
            }
          }
        } catch (e) {
          that._logger.error("_login\n" + e);
        }

        aCallback(loggedIn);
      },
      function (aEvent) {
        that._resetCookiePref();
        that._defaultError("_login", aEvent);
      },
      { "Content-Type" : "application/x-www-form-urlencoded",
        "Referer" : URL_BASE_SSL + "/login",
        "Host" : "www.last.fm" },
      true, params);
  },

  /**
   * Saves the current value of the cookie preference.
   */
  _saveCookiePref : function() {
    this._logger.trace("_saveCookiePref");

    if (COOKIES_ALLOW_THIRD_PARTY != this._cookieBehaviorPref.value) {
      this._lastCookieValue = this._cookieBehaviorPref.value;
      this._cookieBehaviorPref.value = COOKIES_ALLOW_THIRD_PARTY;
    }
  },

  /**
   * Resets the cookie preference to its previous value.
   */
  _resetCookiePref : function() {
    this._logger.trace("_resetCookiePref");

    if (-1 != this._lastCookieValue) {
      this._cookieBehaviorPref.value = this._lastCookieValue;
      this._lastCookieValue = -1;
    }
  },

  /**
   * Loads the Last.fm "grant access" page to authorize Fire.fm to use the
   * user's account and stream music.
   * @param aToken the API authorization token for the user.
   * @param aCallback the method to be called once the result is obtained.
   */
  grantAccess : function(aToken, aCallback) {
    this._logger.debug("grantAccess");

    const PARAMS_GRANT_ACCESS = "api_key=$(API_KEY)&token=$(TOKEN)";

    let that = this;
    let params = PARAMS_GRANT_ACCESS;

    // set parameters.
    params = params.replace(/\$\(TOKEN\)/, encodeURIComponent(aToken));
    params =
      params.replace(/\$\(API_KEY\)/, encodeURIComponent(FireFM.Secret.API_KEY));

    // save the state of the cookie preference.
    this._saveCookiePref();

    FireFM.sendRequest(
      URL_BASE + "/api/auth/?" + params,
      function (aEvent) { that._grantAccessLoad(aEvent, aCallback) },
      function (aEvent) {
        that._resetCookiePref();
        aCallback(false);
        that._defaultError("grantAccess", aEvent);
      },
      null, false);
  },

  /**
   * Load callback handler for the grant access call.
   * @param aEvent the event that triggered this function.
   * @param aCallback the method to be called once the result is obtained.
   */
  _grantAccessLoad : function(aEvent, aCallback) {
    this._logger.trace("_grantAccessLoad");

    try {
      // XXX: using an HTML parser here is a little complicated, so we'll have
      // to rely on RE. We're already very dependent on page layout anyway, so
      // it sucks all the way.
      let formRE = /<form [^>]*action="\/api\/grantAccess"(?:.|\n)*<\/form>/i;
      let inputRE = /<input [^>]*name="([^"]*)" [^>]*value="([^"]*)"[^>]*\/>/ig;
      let responseText = String(aEvent.target.responseText);
      let formMatch = formRE.exec(responseText)[0];
      let inputMatch;
      let params = "";

      while ((inputMatch = inputRE.exec(formMatch)) != null) {
        params +=
          encodeURIComponent(inputMatch[1]) + "=" +
          encodeURIComponent((2 < inputMatch.length) ? inputMatch[2] : "") +
          "&";
      }

      this._finishGrantingAccess(params, aCallback);
    } catch (e) {
      this._resetCookiePref();
      aCallback(false);
      this._logger.error(
        "_grantAccessLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }
  },

  /**
   * Finishes the granting process, sending the form data.
   * @param aParams the parameters to send.
   * @param aCallback the method to be called once the result is obtained.
   */
  _finishGrantingAccess : function(aParams, aCallback) {
    this._logger.trace("_finishGrantingAccess");

    let that = this;

    FireFM.sendRequest(
      URL_BASE + "/api/grantaccess",
      function (aEvent) {
        let granted = false;

        that._resetCookiePref();

        try {
          let responseText = String(aEvent.target.responseText);

          // XXX: is this the best we can do here?
          granted = responseText.match(/Fire\.fm/i);

          if (!granted) {
            that._logger.warn("grantAccess. status: " + aEvent.target.status);
            that._logger.warn(
              "grantAccess. URL: " + aEvent.target.channel.URI.spec);
            that._logger.warn(
              "grantAccess. Text:\n" + aEvent.target.responseText);
          }
        } catch (e) {
          that._logger.error("grantAccess\n" + e);
        }

        aCallback(granted);
      },
      function (aEvent) {
        that._resetCookiePref();
        aCallback(false);
        that._defaultError("grantAccess", aEvent);
      },
      { "Content-Type" : "application/x-www-form-urlencoded" },
      true, aParams);
  },

  /**
   * Performs the auth.getToken call to the API. See:
   * http://www.last.fm/api/show?service=265
   * @param aCallback The method to be called once the token is obtained.
   */
  authGetToken : function(aCallback) {
    this._logger.debug("authGetToken");

    const PARAMS_SIG_GET_TOKEN = "api_key$(API_KEY)methodauth.getToken";
    const PARAMS_GET_TOKEN =
      "?method=auth.getToken&api_key=$(API_KEY)&api_sig=$(API_SIG)";

    let that = this;
    let paramsSig = PARAMS_SIG_GET_TOKEN;
    let params = PARAMS_GET_TOKEN;

    // set parameters.
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, FireFM.Secret.API_KEY);
    params =
      params.replace(
        /\$\(API_KEY\)/, encodeURIComponent(FireFM.Secret.API_KEY));
    // sign call.
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + params,
      function(aEvent) { that._authGetTokenLoad(aEvent, aCallback); },
      function(aEvent) {
        aCallback(null); that._defaultError("authGetToken", aEvent); },
      null, false, null);
  },

  /**
   * Load callback handler for the auth.getToken call.
   * @param aEvent The event that triggered this function.
   * @param aCallback The method to be called and pass the token to.
   */
  _authGetTokenLoad : function(aEvent, aCallback) {
    this._logger.trace("_authGetTokenLoad");

    try {
      let doc = aEvent.target.responseXML;
      let keyNode;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        token = doc.getElementsByTagName("token")[0];
        aCallback(token.textContent);
      } else {
        this._logger.error(
          "_authGetTokenLoad. Invalid data received: " +
          aEvent.target.responseText);
        aCallback(null);
      }
    } catch (e) {
      this._logger.error(
        "_authGetTokenLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      aCallback(null);
    }
  },

  /**
   * Performs the auth.getSession call to the API. See:
   * http://www.last.fm/api/show?service=125
   * @param aToken The authentication token used to fetch the session.
   * @param aCallback The method to be called once the session is obtained.
   */
  authGetSession : function(aToken, aCallback) {
    this._logger.debug("authGetSession");

    const PARAMS_SIG_GET_SESSION =
      "api_key$(API_KEY)methodauth.getSessiontoken$(TOKEN)";
    const PARAMS_GET_SESSION =
      "?method=auth.getSession&api_key=$(API_KEY)&token=$(TOKEN)&" +
      "api_sig=$(API_SIG)";

    let that = this;
    let paramsSig = PARAMS_SIG_GET_SESSION;
    let params = PARAMS_GET_SESSION;

    // set parameters.
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, FireFM.Secret.API_KEY);
    params =
      params.replace(
        /\$\(API_KEY\)/, encodeURIComponent(FireFM.Secret.API_KEY));
    paramsSig = paramsSig.replace(/\$\(TOKEN\)/, aToken);
    params = params.replace(/\$\(TOKEN\)/, encodeURIComponent(aToken));
    // sign call.
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + params,
      function(aEvent) { that._authGetSessionLoad(aEvent, aCallback); },
      function(aEvent) {
        aCallback(null); that._defaultError("authGetSession", aEvent); },
      null, false, null);
  },

  /**
   * Load callback handler for the auth.getToken call.
   * @param aEvent The event that triggered this function.
   * @param aCallback The method to be called and pass the session to.
   */
  _authGetSessionLoad : function(aEvent, aCallback) {
    this._logger.trace("_authGetSessionLoad");

    try {
      let doc = aEvent.target.responseXML;
      let keyNode;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        keyNode = doc.getElementsByTagName("key")[0];
        aCallback(keyNode.textContent);
      } else {
        this._logger.error(
          "_authGetSessionLoad. Invalid data received: " +
          aEvent.target.responseText);
        aCallback(null);
      }
    } catch (e) {
      this._logger.error(
        "_authGetSessionLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      aCallback(null);
    }
  },

  /**
   * Performs the artist.search call to the API. See:
   * http://www.last.fm/api/show?service=272
   * @param aArtistName the name of the artist to search.
   * @param aCallback the callback function used to return artist information
   * back to the caller. This callback gets an object with {success, result}.
   * 2 results are possible: {true, 'Artist'}, {false, 'URLtoSearchPage'}.
   * Note that the artist in the response can be slightly different from the one
   * given as a parameter. This is because Last.fm corrects common errors such
   * as 'Slipnot' -> 'Slipknot'.
   */
  artistSearch : function(aArtistName, aCallback) {
    this._logger.debug("artistSearch");

    const PARAMS_ARTIST_SEARCH =
      "?method=artist.search&artist=$(ARTIST)&api_key=$(API_KEY)&limit=5";

    if (("string" != typeof(aArtistName)) || (0 == aArtistName.length) ||
        ("function" != typeof(aCallback))) {
      throw "Invalid artist name or callback function.";
    }

    let that = this;
    let params = PARAMS_ARTIST_SEARCH;
    let apiKey = encodeURIComponent(FireFM.Secret.API_KEY);

    // set parameters.
    params = params.replace(/\$\(API_KEY\)/, apiKey);
    params = params.replace(/\$\(ARTIST\)/, encodeURIComponent(aArtistName));

    FireFM.sendRequest(
      URL_API_20 + params,
      function(aEvent) {
        that._artistSearchLoad(aEvent, aArtistName, aCallback); },
      function(aEvent) {
        aCallback(
          { success : false, result : that._getSearchURL(aArtistName) }); },
      null, false, null);
  },

  /**
   * Load callback handler for the artist.search call.
   * @param aEvent the event that triggered this function.
   * @param aArtistName the name of the artist to search.
   * @param aCallback the callback function used to return artist information
   * back to the caller.
   */
  _artistSearchLoad : function(aEvent, aArtistName, aCallback) {
    this._logger.trace("_artistSearchLoad");

    try {
      let doc = aEvent.target.responseXML;
      let nameNodes = doc.getElementsByTagName("name");

      if ((null != nameNodes) && (0 < nameNodes.length)) {
        // default to the first result.
        let artist = nameNodes[0].textContent;
        let name;

        // but also look for an exact match.
        for (let i = 0; i < nameNodes.length; i++) {
          name = nameNodes[i].textContent;

          if (aArtistName.toLowerCase() == name.toLowerCase()) {
            artist = name;
            break;
          }
        }

        aCallback({ success : true, result : artist });
      } else {
        aCallback(
          { success : false, result : this._getSearchURL(aArtistName) });
      }
    } catch (e) {
      this._logger.error(
        "_artistSearchLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      aCallback(
        { success : false, result : this._getSearchURL(aArtistName) });
    }
  },

  /**
   * Performs the radio.tune call to the API using the station the user
   * specified.
   * See: http://www.last.fm/api/show?service=160
   */
  tuneRadio : function() {
    this._logger.debug("tuneRadio");

    if (null != FireFM.Login.apiSession) {
      const PARAMS_SIG_TUNE_RADIO =
        "api_key$(API_KEY)methodradio.tunesk$(SESSION_KEY)" +
        "station$(STATION_URL)";
      const PARAMS_TUNE_RADIO =
        "method=radio.tune&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
        "sk=$(SESSION_KEY)&station=$(STATION_URL)";

      let that = this;
      let params = PARAMS_TUNE_RADIO;
      let paramsSig = PARAMS_SIG_TUNE_RADIO;

      let apiKey = FireFM.Secret.API_KEY;
      let sessionKey = FireFM.Login.apiSession;
      let stationURL = FireFM.Station.station.getStationURL();

      // set parameters to obtain signature
      paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
      paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
      paramsSig = paramsSig.replace(/\$\(STATION_URL\)/, stationURL);

      // set parameters
      params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
      params =
        params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
      params =
        params.replace(/\$\(STATION_URL\)/, encodeURIComponent(stationURL));
      params =
        params.replace(
          /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

      FireFM.sendRequest(
        URL_API_20 + "?" + params,
        function(aEvent) { that._tuneRadioLoad(aEvent); },
        function(aEvent) { that._tuneRadioError(aEvent); },
        null, true, FireFM.convertToStream(params));
    } else {
      this._logger.error("tuneRadio. Attempting to play music anonymously.");
    }
  },

  /**
   * Load callback handler for the tune radio request.
   * @param aEvent the event that triggered this function.
   */
  _tuneRadioLoad : function(aEvent) {
    this._logger.trace("_tuneRadioLoad");

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_tuneRadioLoad. Success");
        this.getPlaylist();
      } else {
        this._handleRadioError(doc.getElementsByTagName("error")[0]);
      }
    } catch (e) {
      this._logger.error(
        "_tuneRadioLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      FireFM.obsService.notifyObservers(
        FireFM.Station.station, FireFM.Station.TOPIC_STATION_ERROR,
        FireFM.Station.ERROR_COMMUNICATION_FAILED);
    }
  },

  /**
   * Error callback handler for the tune radio request.
   * @param aEvent the event that triggered this function.
   */
  _tuneRadioError : function(aEvent) {
    this._logger.error("_tuneRadioError");
    FireFM.obsService.notifyObservers(
      FireFM.Station.station, FireFM.Station.TOPIC_STATION_ERROR,
      FireFM.Station.ERROR_COMMUNICATION_FAILED);
    this._defaultError("tuneRadio", aEvent);
  },

  /**
   * Performs the radio.getPlaylist call to the API.
   * See: http://www.last.fm/api/show?service=256
   */
  getPlaylist : function() {
    this._logger.debug("getPlaylist");

    if (null != FireFM.Login.apiSession) {
      const PARAMS_GET_PLAYLIST =
        "method=radio.getPlaylist&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
        "sk=$(SESSION_KEY)&rtp=$(IS_SCROBBLING)";
      const PARAMS_SIG_GET_PLAYLIST =
        "api_key$(API_KEY)methodradio.getPlaylistrtp$(IS_SCROBBLING)" +
        "sk$(SESSION_KEY)";

      let that = this;
      let params = PARAMS_GET_PLAYLIST;
      let paramsSig = PARAMS_SIG_GET_PLAYLIST;

      let apiKey = FireFM.Secret.API_KEY;
      let sessionKey = FireFM.Login.apiSession;
      let isScrobbling = this._scrobbleActive;

      // set parameters to obtain signature
      paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
      paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
      paramsSig = paramsSig.replace(/\$\(IS_SCROBBLING\)/, isScrobbling);

      // set parameters
      params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
      params =
        params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
      params =
        params.replace(/\$\(IS_SCROBBLING\)/, encodeURIComponent(isScrobbling));
      params =
        params.replace(
          /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

      FireFM.sendRequest(
        URL_API_20 + "?" + params,
        function(aEvent) { that._getPlaylistLoad(aEvent); },
        function(aEvent) { that._getPlaylistError(aEvent); },
        null, true, FireFM.convertToStream(params));
    } else {
      // use the old API if the user is not logged in.
      FireFM.Login.getPlaylist();
    }
  },

  /**
   * Load callback handler for the get playlist request.
   * @param aEvent the event that triggered this function.
   */
  _getPlaylistLoad : function(aEvent) {
    this._logger.trace("_getPlaylistLoad");

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_getPlaylistLoad. Success");
        FireFM.Station.loadPlaylist(doc);
      } else {
        this._handleRadioError(doc.getElementsByTagName("error")[0]);
      }
    } catch (e) {
      this._logger.error(
        "_getPlaylistLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      FireFM.obsService.notifyObservers(
        FireFM.Station.station, FireFM.Station.TOPIC_STATION_ERROR,
        FireFM.Station.ERROR_COMMUNICATION_FAILED);
    }
  },

  /**
   * Error callback handler for the get playlist request.
   * @param aEvent the event that triggered this function.
   */
  _getPlaylistError : function(aEvent) {
    this._logger.error("_getPlaylistError");
    FireFM.obsService.notifyObservers(
      FireFM.Station.station, FireFM.Station.TOPIC_STATION_ERROR,
      FireFM.Station.ERROR_COMMUNICATION_FAILED);
    this._defaultError("getPlaylist", aEvent);
  },

  /**
   * Handles a radio error response.
   * @param aErrorNode the error node received in the error response.
   */
  _handleRadioError : function(aErrorNode) {
    this._logger.error("_handleRadioError. Error:\n " + aErrorNode.textContent);

    let error = FireFM.Station.ERROR_COMMUNICATION_FAILED;
    let errorCode = aErrorNode.getAttribute("code");

    switch (errorCode) {
      case "8":
      case "11":
        error = FireFM.Station.ERROR_SERVICE_OFFLINE;
        break;
      case "12":
        error = FireFM.Station.ERROR_NO_SUBSCRIPTION;
        break;
      case "4":
      case "18":
        error = FireFM.Station.ERROR_NO_FREE_PLAYS;
        break;
    }

    FireFM.obsService.notifyObservers(
      FireFM.Station.station, FireFM.Station.TOPIC_STATION_ERROR, error);
  },

  /**
   * Performs the tag.search call to the API. See:
   * http://www.last.fm/api/show?service=273
   * @param aTagName the name of the tag to search.
   * @param aCallback the callback function used to return tag information back
   * to the caller. This callback gets an object with {success, result}.
   * 2 results are possible: {true, 'tag'}, {false, 'URLtoSearchPage'}.
   * Note that the tag in the response can be slightly different from the one
   * given as a parameter. This is because Last.fm corrects common errors such
   * as 'Slipnot' -> 'Slipknot'.
   */
  tagSearch : function(aTagName, aCallback) {
    this._logger.debug("tagSearch");

    const PARAMS_TAG_SEARCH =
      "?method=tag.getInfo&api_key=$(API_KEY)&limit=1&tag=$(TAG)";

    if (("string" != typeof(aTagName)) || (0 == aTagName.length) ||
        ("function" != typeof(aCallback))) {
      throw "Invalid tag name or callback function.";
    }

    let that = this;
    let params = PARAMS_TAG_SEARCH;
    let apiKey = encodeURIComponent(FireFM.Secret.API_KEY);
    let tagName = aTagName.replace(/\s/g, "_")

    // set parameters.
    params = params.replace(/\$\(API_KEY\)/, apiKey);
    params = params.replace(/\$\(TAG\)/, encodeURIComponent(tagName));

    FireFM.sendRequest(
      URL_API_20 + params,
      function(aEvent) { that._tagSearchLoad(aEvent, aTagName, aCallback); },
      function(aEvent) {
        aCallback(
          { success : false, result : that._getSearchURL(aTagName, true) }); },
      null, false, null);
  },

  /**
   * Load callback handler for the tag.search call.
   * @param aEvent the event that triggered this function.
   * @param aTagName the name of the tag to search.
   * @param aCallback the callback function used to return tag information back
   * to the caller.
   */
  _tagSearchLoad : function(aEvent, aTagName, aCallback) {
    this._logger.trace("_tagSearchLoad");

    try {
      let doc = aEvent.target.responseXML;
      let nameNodes = doc.getElementsByTagName("name");

      if ((null != nameNodes) && (0 < nameNodes.length)) {
        let tag = nameNodes[0].textContent;

        aCallback({ success : true, result : tag });
      } else {
        aCallback(
          { success : false, result : this._getSearchURL(aTagName, true) });
      }
    } catch (e) {
      this._logger.error(
        "_tagSearchLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      aCallback(
        { success : false, result : this._getSearchURL(aTagName, true) });
    }
  },

  /**
   * Generates a search URL for the given string.
   * @param aString the query given by the user.
   * @param aIsTag true if the search URL should be for a tag.
   */
  _getSearchURL : function(aString, aIsTag) {
    this._logger.trace("_getSearchURL");

    let url =
      URL_SEARCH + FireFM.encodeFMString(aString) + (aIsTag ? "&m=tags" : "");

    return url;
  },

  /**
   * Performs the artist.getTags, track.getTags or album.getTags calls to the
   * API, using the given track. The API method called depends on the given tag
   * type. See:
   * http://www.last.fm/api/show?service=318
   * http://www.last.fm/api/show?service=320
   * http://www.last.fm/api/show?service=317
   * @param aTrack The track object to which tags will be added.
   * @param aTagType The type of tag to be added: artist, track or album.
   * @param aCallback The method to be called when the response is received.
   */
  getTags : function(aTrack, aTagType, aCallback) {
    this._logger.debug("getTags");

    let that = this;
    let params;
    let paramsSig;

    let apiKey = FireFM.Secret.API_KEY;
    let sessionKey = FireFM.Login.apiSession;

    switch (aTagType) {
      case this.TAG_TYPE_ARTIST:
        const PARAMS_ARTIST_GET_TAGS =
          "method=artist.getTags&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&artist=$(ARTIST)";
        const PARAMS_SIG_ARTIST_GET_TAGS =
          "api_key$(API_KEY)artist$(ARTIST)methodartist.getTags"+
          "sk$(SESSION_KEY)";

        params = PARAMS_ARTIST_GET_TAGS;
        paramsSig = PARAMS_SIG_ARTIST_GET_TAGS;
        break;
      case this.TAG_TYPE_TRACK:
        const PARAMS_TRACK_GET_TAGS =
          "method=track.getTags&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&track=$(TRACK)&artist=$(ARTIST)";
        const PARAMS_SIG_TRACK_GET_TAGS =
          "api_key$(API_KEY)artist$(ARTIST)methodtrack.getTags" +
          "sk$(SESSION_KEY)track$(TRACK)";

        params = PARAMS_TRACK_GET_TAGS;
        paramsSig = PARAMS_SIG_TRACK_GET_TAGS;
        break;
      case this.TAG_TYPE_ALBUM:
        const PARAMS_ALBUM_GET_TAGS =
          "method=album.getTags&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&album=$(ALBUM)&artist=$(ARTIST)";
        const PARAMS_SIG_ALBUM_GET_TAGS =
          "album$(ALBUM)api_key$(API_KEY)artist$(ARTIST)methodalbum.getTags" +
          "sk$(SESSION_KEY)";

        params = PARAMS_ALBUM_GET_TAGS;
        paramsSig = PARAMS_SIG_ALBUM_GET_TAGS;
        break;
    }

    // set parameters to obtain signature
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
    paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
    paramsSig = paramsSig.replace(/\$\(TRACK\)/, aTrack.title);
    paramsSig = paramsSig.replace(/\$\(ARTIST\)/, aTrack.artist);
    paramsSig = paramsSig.replace(/\$\(ALBUM\)/, aTrack.album);

    // set parameters
    params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
    params =
      params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
    params = params.replace(/\$\(TRACK\)/, encodeURIComponent(aTrack.title));
    params = params.replace(/\$\(ARTIST\)/, encodeURIComponent(aTrack.artist));
    params = params.replace(/\$\(ALBUM\)/, encodeURIComponent(aTrack.album));
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + "?" + params,
      function(aEvent) { that._getTagsLoad(aEvent, aCallback); },
      function(aEvent) {
        that._defaultError("getTags", aEvent);
        aCallback([]);
      },
      null, true, FireFM.convertToStream(params));
  },

  /**
   * Load callback handler for the getTags request.
   * @param aEvent The event that triggered this function.
   */
  _getTagsLoad : function(aEvent, aCallback) {
    this._logger.trace("_getTagsLoad");

    let tags = [];

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_getTagsLoad. Success");

        let tagNodes = doc.getElementsByTagName("tag");

        for (let i = 0; i < tagNodes.length; i++) {
          tags.push(tagNodes[i].getElementsByTagName("name")[0].textContent);
        }

      } else {
        let error = doc.getElementsByTagName("error")[0].textContent;
        this._logger.error("_getTagsLoad. Failed: " + error);
      }
    } catch (e) {
      this._logger.error(
        "_getTagsLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }

    aCallback(tags);
  },

  /**
   * Performs the artist.addTags, track.addTags or album.addTags calls to the
   * API, using the given track. The API method called depends on the given tag
   * type. See:
   * http://www.last.fm/api/show?service=303
   * http://www.last.fm/api/show?service=304
   * http://www.last.fm/api/show?service=302
   * @param aTrack The track object to which tags will be added
   * @param aTagType The type of tag to be added: artist, track or album.
   * @param aTags The array of tags to be added.
   */
  addTags : function(aTrack, aTagType, aTags) {
    this._logger.debug("addTags");

    let that = this;
    let params;
    let paramsSig;

    let apiKey = FireFM.Secret.API_KEY;
    let sessionKey = FireFM.Login.apiSession;
    let tags = String(aTags);

    switch (aTagType) {
      case this.TAG_TYPE_ARTIST:
        const PARAMS_ARTIST_ADD_TAGS =
          "method=artist.addTags&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&artist=$(ARTIST)&tags=$(TAGS)";
        const PARAMS_SIG_ARTIST_ADD_TAGS =
          "api_key$(API_KEY)artist$(ARTIST)methodartist.addTags"
          "sk$(SESSION_KEY)tags$(TAGS)";

        params = PARAMS_ARTIST_ADD_TAGS;
        paramsSig = PARAMS_SIG_ARTIST_ADD_TAGS;
        break;
      case this.TAG_TYPE_TRACK:
        const PARAMS_TRACK_ADD_TAGS =
          "method=track.addTags&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&track=$(TRACK)&artist=$(ARTIST)&tags=$(TAGS)";
        const PARAMS_SIG_TRACK_ADD_TAGS =
          "api_key$(API_KEY)artist$(ARTIST)methodtrack.addTags" +
          "sk$(SESSION_KEY)tags$(TAGS)track$(TRACK)";

        params = PARAMS_TRACK_ADD_TAGS;
        paramsSig = PARAMS_SIG_TRACK_ADD_TAGS;
        break;
      case this.TAG_TYPE_ALBUM:
        const PARAMS_ALBUM_ADD_TAGS =
          "method=album.addTags&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&album=$(ALBUM)&artist=$(ARTIST)&tags=$(TAGS)";
        const PARAMS_SIG_ALBUM_ADD_TAGS =
          "album$(ALBUM)api_key$(API_KEY)artist$(ARTIST)methodalbum.addTags" +
          "sk$(SESSION_KEY)tags$(TAGS)";

        params = PARAMS_ALBUM_ADD_TAGS;
        paramsSig = PARAMS_SIG_ALBUM_ADD_TAGS;
        break;
    }

    // set parameters to obtain signature
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
    paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
    paramsSig = paramsSig.replace(/\$\(TRACK\)/, aTrack.title);
    paramsSig = paramsSig.replace(/\$\(ARTIST\)/, aTrack.artist);
    paramsSig = paramsSig.replace(/\$\(ALBUM\)/, aTrack.album);
    paramsSig = paramsSig.replace(/\$\(TAGS\)/, tags);

    // set parameters
    params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
    params =
      params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
    params = params.replace(/\$\(TRACK\)/, encodeURIComponent(aTrack.title));
    params = params.replace(/\$\(ARTIST\)/, encodeURIComponent(aTrack.artist));
    params = params.replace(/\$\(ALBUM\)/, encodeURIComponent(aTrack.album));
    params = params.replace(/\$\(TAGS\)/, encodeURIComponent(tags));
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + "?" + params,
      function(aEvent) { that._addTagsLoad(aEvent); },
      function(aEvent) { that._defaultError("addTags", aEvent); },
      null, true, FireFM.convertToStream(params));
  },

  /**
   * Load callback handler for the addTags request.
   * @param aEvent The event that triggered this function.
   */
  _addTagsLoad : function(aEvent) {
    this._logger.trace("_addTagsLoad");

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_addTagsLoad. Success");
      } else {
        let error = doc.getElementsByTagName("error")[0].textContent;
        this._logger.error("_addTagsLoad. Failed: " + error);
      }
    } catch (e) {
      this._logger.error(
        "_addTagsLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }
  },

  /**
   * Performs the artist.removeTag, track.removeTag or album.removeTag calls to
   * the API, using the given track. The API method called depends on the given
   * tag type. See:
   * http://www.last.fm/api/show?service=315
   * http://www.last.fm/api/show?service=316
   * http://www.last.fm/api/show?service=314
   * @param aTrack The track object from which the tag will be removed.
   * @param aTagType The type of tag to be removed: artist, track or album.
   * @param aTag The tag to be removed.
   */
  removeTag : function(aTrack, aTagType, aTag) {
    this._logger.debug("removeTag");

    let that = this;
    let params;
    let paramsSig;

    let apiKey = FireFM.Secret.API_KEY;
    let sessionKey = FireFM.Login.apiSession;

    switch (aTagType) {
      case this.TAG_TYPE_ARTIST:
        const PARAMS_ARTIST_REMOVE_TAG =
          "method=artist.removeTag&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&artist=$(ARTIST)&tag=$(TAG)";
        const PARAMS_SIG_ARTIST_REMOVE_TAG =
          "api_key$(API_KEY)artist$(ARTIST)methodartist.removeTag" +
          "sk$(SESSION_KEY)tag$(TAG)";

        params = PARAMS_ARTIST_REMOVE_TAG;
        paramsSig = PARAMS_SIG_ARTIST_REMOVE_TAG;
        break;
      case this.TAG_TYPE_TRACK:
        const PARAMS_TRACK_REMOVE_TAG =
          "method=track.removeTag&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&track=$(TRACK)&artist=$(ARTIST)&tag=$(TAG)";
        const PARAMS_SIG_TRACK_REMOVE_TAG =
          "api_key$(API_KEY)artist$(ARTIST)methodtrack.removeTag" +
          "sk$(SESSION_KEY)tag$(TAG)track$(TRACK)";

        params = PARAMS_TRACK_REMOVE_TAG;
        paramsSig = PARAMS_SIG_TRACK_REMOVE_TAG;
        break;
      case this.TAG_TYPE_ALBUM:
        const PARAMS_ALBUM_REMOVE_TAG =
          "method=album.removeTag&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
          "sk=$(SESSION_KEY)&album=$(ALBUM)&artist=$(ARTIST)&tag=$(TAG)";
        const PARAMS_SIG_ALBUM_REMOVE_TAG =
          "album$(ALBUM)api_key$(API_KEY)artist$(ARTIST)methodalbum.removeTag" +
          "sk$(SESSION_KEY)tag$(TAG)";

        params = PARAMS_ALBUM_REMOVE_TAG;
        paramsSig = PARAMS_SIG_ALBUM_REMOVE_TAG;
        break;
    }

    // set parameters to obtain signature
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
    paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
    paramsSig = paramsSig.replace(/\$\(TRACK\)/, aTrack.title);
    paramsSig = paramsSig.replace(/\$\(ARTIST\)/, aTrack.artist);
    paramsSig = paramsSig.replace(/\$\(ALBUM\)/, aTrack.album);
    paramsSig = paramsSig.replace(/\$\(TAG\)/, aTag);

    // set parameters
    params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
    params =
      params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
    params = params.replace(/\$\(TRACK\)/, encodeURIComponent(aTrack.title));
    params = params.replace(/\$\(ARTIST\)/, encodeURIComponent(aTrack.artist));
    params = params.replace(/\$\(ALBUM\)/, encodeURIComponent(aTrack.album));
    params = params.replace(/\$\(TAG\)/, encodeURIComponent(aTag));
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + "?" + params,
      function(aEvent) { that._removeTagLoad(aEvent); },
      function(aEvent) { that._defaultError("removeTag", aEvent); },
      null, true, FireFM.convertToStream(params));
  },

  /**
   * Load callback handler for the removeTag request.
   * @param aEvent The event that triggered this function.
   */
  _removeTagLoad : function(aEvent) {
    this._logger.trace("_removeTagLoad");

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_removeTagLoad. Success");
      } else {
        let error = doc.getElementsByTagName("error")[0].textContent;
        this._logger.error("_removeTagLoad. Failed: " + error);
      }
    } catch (e) {
      this._logger.error(
        "_removeTagLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }
  },

  /**
   * Performs the track.love call to the API using the track being played.
   * See: http://www.last.fm/api/show?service=260
   */
  loveTrack : function() {
    this._logger.debug("loveTrack");

    const PARAMS_SIG_TRACK_LOVE =
      "api_key$(API_KEY)artist$(ARTIST)methodtrack.lovesk$(SESSION_KEY)" +
      "track$(TRACK)";
    const PARAMS_TRACK_LOVE =
      "method=track.love&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
      "sk=$(SESSION_KEY)&track=$(TRACK)&artist=$(ARTIST)";

    let that = this;
    let params = PARAMS_TRACK_LOVE;
    let paramsSig = PARAMS_SIG_TRACK_LOVE;

    let apiKey = FireFM.Secret.API_KEY;
    let sessionKey = FireFM.Login.apiSession;
    let track = FireFM.Playlist.currentTrack.title;
    let artist = FireFM.Playlist.currentTrack.artist;

    // set parameters to obtain signature
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
    paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
    paramsSig = paramsSig.replace(/\$\(TRACK\)/, track);
    paramsSig = paramsSig.replace(/\$\(ARTIST\)/, artist);

    // set parameters
    params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
    params =
      params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
    params = params.replace(/\$\(TRACK\)/, encodeURIComponent(track));
    params = params.replace(/\$\(ARTIST\)/, encodeURIComponent(artist));
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + "?" + params,
      function(aEvent) { that._loveTrackLoad(aEvent); },
      function(aEvent) { that._loveTrackError(aEvent); },
      null, true, FireFM.convertToStream(params));
  },

  /**
   * Load callback handler for the love track request.
   * @param aEvent the event that triggered this function.
   */
  _loveTrackLoad : function(aEvent) {
    this._logger.trace("_loveTrackLoad");

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_loveTrackLoad. Success");
        this._loved = true;
        FireFM.obsService.notifyObservers(null, this.TOPIC_TRACK_LOVED, true);
      } else {
        let error = doc.getElementsByTagName("error")[0].textContent;
        this._logger.error("_loveTrackLoad. Failed: " + error);
        FireFM.obsService.notifyObservers(null, this.TOPIC_TRACK_LOVED, false);
      }
    } catch (e) {
      this._logger.error(
        "_loveTrackLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
      FireFM.obsService.notifyObservers(null, this.TOPIC_TRACK_LOVED, false);
    }
  },

  /**
   * Error callback handler for the love track request.
   * @param aEvent the event that triggered this function.
   */
  _loveTrackError : function(aEvent) {
    this._logger.error("_loveTrackError");
    FireFM.obsService.notifyObservers(null, this.TOPIC_TRACK_LOVED, false);
    this._defaultError("loveTrack", aEvent);
  },

  /**
   * Performs the track.ban call to the API using the track being played.
   * See: http://www.last.fm/api/show?service=260
   */
  banTrack : function() {
    this._logger.debug("banTrack");

    const PARAMS_TRACK_BAN =
      "method=track.ban&api_key=$(API_KEY)&api_sig=$(API_SIG)&" +
      "sk=$(SESSION_KEY)&track=$(TRACK)&artist=$(ARTIST)";
    const PARAMS_SIG_TRACK_BAN =
      "api_key$(API_KEY)artist$(ARTIST)methodtrack.bansk$(SESSION_KEY)" +
      "track$(TRACK)";

    let that = this;
    let params = PARAMS_TRACK_BAN;
    let paramsSig = PARAMS_SIG_TRACK_BAN;

    let apiKey = FireFM.Secret.API_KEY;
    let sessionKey = FireFM.Login.apiSession;
    let track = FireFM.Playlist.currentTrack.title;
    let artist = FireFM.Playlist.currentTrack.artist;

    this._banned = true;

    // set parameters to obtain signature
    paramsSig = paramsSig.replace(/\$\(API_KEY\)/, apiKey);
    paramsSig = paramsSig.replace(/\$\(SESSION_KEY\)/, sessionKey);
    paramsSig = paramsSig.replace(/\$\(TRACK\)/, track);
    paramsSig = paramsSig.replace(/\$\(ARTIST\)/, artist);

    // set parameters
    params = params.replace(/\$\(API_KEY\)/, encodeURIComponent(apiKey));
    params =
      params.replace(/\$\(SESSION_KEY\)/,encodeURIComponent(sessionKey));
    params = params.replace(/\$\(TRACK\)/, encodeURIComponent(track));
    params = params.replace(/\$\(ARTIST\)/, encodeURIComponent(artist));
    params =
      params.replace(
        /\$\(API_SIG\)/, FireFM.Secret.generateSignature(paramsSig));

    FireFM.sendRequest(
      URL_API_20 + "?" + params,
      function(aEvent) { that._banTrackLoad(aEvent); },
      function(aEvent) { that._banTrackError(aEvent); },
      null, true, FireFM.convertToStream(params));
  },

  /**
   * Load callback handler for the ban track request.
   * @param aEvent The event that triggered this function.
   */
  _banTrackLoad : function(aEvent) {
    this._logger.trace("_banTrackLoad");

    try {
      let doc = aEvent.target.responseXML;

      if ("ok" == doc.documentElement.getAttribute("status")) {
        this._logger.trace("_banTrackLoad. Success");
      } else {
        let error = doc.getElementsByTagName("error")[0].textContent;
        this._logger.error("_banTrackLoad. Failed: " + error);
      }
    } catch (e) {
      this._logger.error(
        "_banTrackLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }
  },

  /**
   * Error callback handler for the ban track request.
   * @param aEvent The event that triggered this function.
   */
  _banTrackError : function(aEvent) {
    this._logger.error("_banTrackError");
    this._defaultError("banTrack", aEvent);
  },

  /**
   * Sends a handshake request for to begin a Scrobble session.
   * See: http://www.last.fm/api/submissions
   * @param aCallback (optional) function to be called if the handshake is
   * successful.
   */
  scrobbleHandshake : function(aCallback) {
    this._logger.debug("scrobbleHandshake");

    const SCROBBLE_CLIENT_ID = "ffm";
    const SCROBBLE_CLIENT_VERSION = "1.2";
    const PARAMS_SCROBBLE_HANDSHAKE =
      "?hs=true&p=1.2.1&c=" + encodeURIComponent(SCROBBLE_CLIENT_ID) + "&v=" +
      encodeURIComponent(SCROBBLE_CLIENT_VERSION) +
      "&u=$(USER)&t=$(TIMESTAMP)&a=$(AUTH)&api_key=$(API_KEY)&" +
      "sk=$(SESSION_KEY)";

    let that = this;
    let params = PARAMS_SCROBBLE_HANDSHAKE;
    let timestamp = Math.floor(Date.now() / 1000);
    let auth =
      encodeURIComponent(FireFM.Secret.generateScrobbleAuth(timestamp));

    // set parameters.
    params =
      params.replace(/\$\(USER\)/, encodeURIComponent(FireFM.Login.userName));
    params = params.replace(/\$\(TIMESTAMP\)/, timestamp);
    params = params.replace(/\$\(AUTH\)/, auth);
    params =
      params.replace(
        /\$\(API_KEY\)/, encodeURIComponent(FireFM.Secret.API_KEY));
    params =
      params.replace(
        /\$\(SESSION_KEY\)/, encodeURIComponent(FireFM.Login.apiSession));

    FireFM.sendRequest(
      URL_SCROBBLE_1_2 + params,
      function(aEvent) { that._scrobbleHandshakeLoad(aEvent, aCallback); },
      function(aEvent) { that._defaultError("scrobbleHandshake", aEvent); },
      null, false, null);
  },

  /**
   * Load callback handler for the Scrobble handshake request.
   * @param aEvent the event that triggered this function.
   * @param aCallback (optional) function to be called if the handshake is
   * successful.
   */
  _scrobbleHandshakeLoad : function(aEvent, aCallback) {
    this._logger.trace("_scrobbleHandshakeLoad");

    try {
      let data = aEvent.target.responseText;
      let lines = data.split("\n");

      // do a little integrity check.
      if ((4 <= lines.length) && ("OK" == lines[0])) {
        this._scrobbleSessionId = lines[1];
        this._scrobbleURLNowPlaying = lines[2].replace(/\:80/, "");
        this._scrobbleURLSubmit = lines[3].replace(/\:80/, "");
        FireFM.obsService.addObserver(
          this, FireFM.Player.TOPIC_PROGRESS_CHANGED, false);
        this._logger.debug("_scrobbleHandshakeLoad. Scrobble data loaded.");

        if (aCallback) {
          aCallback();
        }
      } else {
        this._logger.error(
          "_scrobbleHandshakeLoad. Invalid data received: " + data);
      }
    } catch (e) {
      this._logger.error(
        "_scrobbleHandshakeLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }
  },

  /**
   * Sends the 'Now Playing' call to the Scrobble URL, with the information of
   * the given track.
   * See: http://www.last.fm/api/submissions#np
   * @param aTrack the track to send information about.
   */
  _sendNowPlaying : function(aTrack) {
    this._logger.debug("_sendNowPlaying");

    if (this._scrobbleActive && (null != this._scrobbleSessionId)) {
      const PARAMS_SCROBBLE_PLAYING =
        "s=$(SCROBBLE_KEY)&a=$(ARTIST)&t=$(TRACK)&b=$(ALBUM)&l=&n=&m=";

      let that = this;
      let params = PARAMS_SCROBBLE_PLAYING;

      params = params.replace(/\$\(SCROBBLE_KEY\)/, this._scrobbleSessionId);
      params =
        params.replace(/\$\(ARTIST\)/, encodeURIComponent(aTrack.artist));
      params = params.replace(/\$\(TRACK\)/, encodeURIComponent(aTrack.title));
      params =
        params.replace(/\$\(ALBUM\)/, encodeURIComponent(aTrack.albumTitle));

      FireFM.sendRequest(
        this._scrobbleURLNowPlaying,
        function(aEvent) {
          that._logger.debug("_sendNowPlaying: " + aEvent.target.responseText);
        },
        function(aEvent) { that._defaultError("sendNowPlaying", aEvent); },
        null, true, params);
    }
  },

  /**
   * Sends the last track to the Scrobble service, if it should.
   * See: http://www.last.fm/api/submissions#subs
   * @param aTrack optional argument that 'forces' a specific track to be
   * Scrobbled, instead of the one in queue.
   */
  scrobbleTrack : function(aTrack) {
    this._logger.debug("scrobbleTrack");

    let track = (aTrack ? aTrack : this._toBeScrobbled);

    if (this._scrobbleActive && (null != track)) {
      const PARAMS_SCROBBLE_SUBMIT =
        [ "s", "a[0]", "t[0]", "b[0]", "o[0]", "m[0]", "n[0]", "l[0]", "i[0]",
          "r[0]" ];

      let that = this;
      let rating =
        (this._banned ? "B" : (this._loved ? "L" : (this._skipped ? "S" : "")));
      let postParams =
        [ this._scrobbleSessionId, track.artist, track.title, track.albumTitle,
         ("L" + track.trackAuth), "", "", track.duration, track.startTime,
         rating ];
      let postString = "";
      let inputStream;

      // generate the POST string.
      for (let i = 0; i < PARAMS_SCROBBLE_SUBMIT.length; i++) {
        postString +=
          (0 < i ? "&" : "") + encodeURIComponent(PARAMS_SCROBBLE_SUBMIT[i]) +
          "=" + encodeURIComponent(postParams[i]);
      }

      inputStream = FireFM.convertToStream(postString);

      FireFM.sendRequest(
        this._scrobbleURLSubmit,
        function(aEvent) { that._scrobbleTrackLoad(aEvent, track); },
        function(aEvent) { that._defaultError("scrobbleTrack", aEvent); },
        { "Content-Type" : "application/x-www-form-urlencoded" }, true,
        inputStream);
    }
  },

  /**
   * Load callback handler for the Scrobble track request.
   * @param aEvent the event that triggered this function.
   * @param aTrack the scrobbled track. In case of session error, we can
   * Scrobble again.
   */
  _scrobbleTrackLoad : function(aEvent, aTrack) {
    this._logger.trace("_scrobbleTrackLoad");

    try {
      let data = aEvent.target.responseText;

      if (0 == data.indexOf("OK")) {
        this._logger.trace("_scrobbleTrackLoad. Success");
      } else if (0 == data.indexOf("BADSESSION")) {
        let that = this;

        this._logger.warn("_scrobbleTrackLoad. Bad session. Reconnecting.");

        try {
          FireFM.obsService.removeObserver(
            this, FireFM.Player.TOPIC_PROGRESS_CHANGED);
        } catch (e) {
          this._logger.warn(
            "_scrobbleTrackLoad. Error removing observer:\n" + e);
        }

        // retry the handshake and run the Scrobble call if it works.
        this.scrobbleHandshake(function() { that.scrobbleTrack(aTrack); });
      } else {
        this._logger.error(
          "_scrobbleTrackLoad. Invalid data received: " + data);
      }
    } catch (e) {
      this._logger.error(
        "_scrobbleTrackLoad. Invalid data received: " +
        aEvent.target.responseText + "\nError:\n" + e);
    }
  },

  /**
   * Indicates if the track can be Scrobbled or not.
   * See: http://www.last.fm/api/submissions#subs
   * @param aTrack the track to check for Scrobbling.
   * @param aProgress the current progress percentage.
   * @return true if the track can be Scrobbled, false otherwise.
   */
  _canScrobble : function(aTrack, aProgress) {
    // XXX: no logging here for performance reasons.
    let canScrobble =
      ((50 <= parseInt(aProgress, 10)) ||
       (SCROBBLE_TIME <= ((aTrack.duration * aProgress) / 100)));

    return canScrobble;
  },

  /**
   * Marks the current track as 'skipped'.
   */
  skipTrack : function() {
    this._logger.debug("skipTrack");
    this._skipped = true;
  },

  /**
   * Obtains the feed from the specified URL, and notifies the callback handler
   * of the result.
   * @param aURL the URL to fetch the feed from.
   * @param aCallback the callback method for this call. This callback gets the
   * XMLHTTPRequest object, or null in case an error occurs.
   */
  fetchFeed : function(aURL, aCallback) {
    this._logger.debug("fetchFeed");

    let that = this;

    FireFM.sendRequest(
      aURL, function(aEvent) { aCallback(aEvent.target); },
      function(aEvent) {
        aCallback(null); that._defaultError("fetchFeed", aEvent); },
      null, false);
  },

  /**
   * Sends a player load error to our Sourceforge bug tracker.
   * @para aErrorInfo string with the details of the error to be sent.
   */
  sendPlayerLoadError : function(aErrorInfo) {
    this._logger.debug("sendPlayerLoadError");

    const URL_SOURCEFORGE_SUBMIT =
      "https://sourceforge.net/tracker/?group_id=226773&atid=1120935&" +
      "func=postadd&category_id=100&artifact_group_id=100&summary=$(SUMMARY)&" +
      "details=$(DETAILS)&submit=SUBMIT";

    let timestamp = new Date().getTime();
    let url = URL_SOURCEFORGE_SUBMIT;
    let that = this;

    url =
      url.replace(
        /\$\(SUMMARY\)/, encodeURIComponent("Player load error " + timestamp));
    url = url.replace(/\$\(DETAILS\)/, encodeURIComponent(aErrorInfo));

    FireFM.sendRequest(
      url, function(aEvent) { that._sendPlayerLoadErrorLoad(aEvent); },
      function(aEvent) { that._defaultError("sendPlayerLoadError", aEvent); },
      { "Content-Type" : "application/x-www-form-urlencoded" }, false, null);
  },

  /**
   * Load callback handler for the send player load error request.
   * @param aEvent the event that triggered this function.
   */
  _sendPlayerLoadErrorLoad : function(aEvent) {
    this._logger.error(
      "_sendPlayerLoadErrorLoad. Response: " + aEvent.target.responseText);
  },

  /**
   * Default error callback handler for the asynchronous requests.
   * @param aSource a string that identifies the source of the error.
   * @param aEvent the event that triggered this function.
   */
  _defaultError : function(aSource, aEvent) {
    this._logger.debug("_defaultError");

    try {
      this._logger.error(
        "_defaultError. Source: " + aSource + ", status: " +
        aEvent.target.status + ", response: \n" + aEvent.target.responseText);
    } catch (e) {
      this._logger.error("_defaultError. Error:\n" + e);
    }
  },

  /**
   * FUEL event handler. We use it to listen to changes to the Scrobble
   * preference.
   * @param aEvent the event that triggered this function.
   */
  handleEvent : function(aEvent) {
    this._logger.debug("handleEvent");
    this._scrobbleActive = this._scrobblePref.value;

    if (this._scrobbleActive && (null != FireFM.Login.userName)) {
      this._sendScrobbleHandshake(false);
    }
  },

  /**
   * Observes notifications of cookie and track activity.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data related to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    // XXX: there is no logging here for performance purposes.
    switch (aTopic) {
      case FireFM.Player.TOPIC_TRACK_LOADED:
        this.scrobbleTrack();
        this._toBeScrobbled = null;
        this._loved = false;
        this._banned = false;
        this._skipped = false;
        this._sendNowPlaying(FireFM.unwrap(aSubject));
        break;
      case FireFM.Player.TOPIC_PROGRESS_CHANGED:
        let currentTrack = FireFM.Playlist.currentTrack;

        // check that Scrobbling is active, the track has not already been
        // marked to be Scrobbled, that the duration of the track is at least
        // 30 seconds, and that the track can be Scrobbled depending on its
        // progress.
        if (this._scrobbleActive && (null != this._scrobbleSessionId) &&
            (null == this._toBeScrobbled) &&
            (SCROBBLE_MIN_DURATION <= currentTrack.duration) &&
            this._canScrobble(currentTrack, aData)) {
          this._toBeScrobbled = currentTrack;
          this._logger.debug("observe. This track will be scrobbled.");
        }

        break;
    }
  }
};

/**
 * FireFM.Remote constructor.
 */
(function() {
  this.init();
}).apply(FireFM.Remote);
