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

Components.utils.import("resource://firefm/fmCommon.js");

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Account Dialog controller.
 */
FireFMChrome.AccountDialog = {

  /* Logger for this object. */
  _logger : null,
  /* String bundle in the overlay. */
  _bundle : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFMChrome.AccountDialog");
    this._logger.debug("init");
    // get the string bundle.
    this._bundle = document.getElementById("firefm-string-bundle");
  },

  /**
   * Opens the last.fm account sign up page and closes the dialog.
   */
  openJoinPage : function() {
    this._logger.debug("openJoinPage");

    let wm =
      Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);

    let mainWindow = wm.getMostRecentWindow("navigator:browser");
    mainWindow.openUILinkIn("http://www.last.fm/join", "tab");

    window.close();
  },

  /**
   * Sets a status message in the dialog.
   * @param aMessage The message to be displayed.
   * @param aBusy Whether or not the UI should be displayed as "busy".
   */
  _setMessage : function(aMessage, aBusy) {
    let label = document.getElementById("firefm-account-message");
    label.setAttribute("value", aMessage);
    this._setBusy(aBusy);
  },

  /**
   * Changes the display of the UI to and from "busy" (throbber, disabled form).
   * @param aBusy Whether or not the UI should be displayed as "busy".
   */
  _setBusy : function(aBusy) {
    if (aBusy) {
      document.getElementById("firefm-account-username").
        setAttribute("disabled", true);
      document.getElementById("firefm-account-password").
        setAttribute("disabled", true);
      document.getElementById("firefm-account-throbber").
        removeAttribute("collapsed");
      document.getElementById("firefm-account-dialog").
        setAttribute("buttondisabledaccept", true);
    }
    else {
      document.getElementById("firefm-account-username").
        removeAttribute("disabled");
      document.getElementById("firefm-account-password").
        removeAttribute("disabled");
      document.getElementById("firefm-account-throbber").
        setAttribute("collapsed", true);
      document.getElementById("firefm-account-dialog").
        removeAttribute("buttondisabledaccept");
    }
  },

  /**
   * Event fired when the "Add Account" dialog button is pressed.
   * The authorization flow begins with this method. Checks the username and
   * password fields and verifies the account.
   */
  onDialogAccept : function() {
    this._logger.debug("onAddAccount");

    let username = document.getElementById("firefm-account-username").value;
    let password = document.getElementById("firefm-account-password").value;

    if (!username.match(/[^\s]+/g) || !password.match(/[^\s]+/g)) {
      this._setMessage(this._bundle.getString("firefm.enterUserPass.label"));
    }
    else {
      let t = this;
      FireFM.Remote.verifyAccount(
        username, password,
        function(aValidAccount) { t.onAccountVerified(aValidAccount); });

      this._setMessage(
        this._bundle.getString("firefm.verifyAccount.label"), true);
    }
    return false;
  },

  /**
   * Handles the response from the FireFM.Remote.verifyAccount method. If the
   * account is valid, the authorization flow continues: getting an API token.
   * @param aValidAccount Whether or not the account is valid.
   */
  onAccountVerified : function(aValidAccount) {
    this._logger.trace("onAccountVerified");

    if (!aValidAccount) {
      this._setMessage(this._bundle.getString("firefm.invalidUserPass.label"));
      return;
    }

    let promptService =
      Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Components.interfaces.nsIPromptService);
    let disclaimer =
      this._bundle.getString("firefm.permissionRequest.label") + "\n\n" +
      this._bundle.getString("firefm.disclaimerIntro.label") + "\n\n" +
      this._bundle.getString("firefm.disclaimer.label");
    let title = this._bundle.getString("firefm.givePermission.title");

    this._setMessage(
      this._bundle.getString("firefm.givingPermission.label"), true);

    if (!promptService.confirm(window, title, disclaimer)) {
      this._setMessage("", false);
    } else {
      let t = this;
      FireFM.Remote.authGetToken(function(aToken) { t.onGetToken(aToken); });
    }
  },

  /**
   * Handles the response from the FireFM.Remote.authGetToken method. If the
   * token is valid, the authorization flow continues: granting access to Fire.fm.
   * @param aToken The generated API token for the user.
   */
  onGetToken : function(aToken) {
    this._logger.debug("onGetToken");

    if (!aToken) {
      this._logger.error("API Token could not be obtained");
      this._setMessage(this._bundle.getString("firefm.permissionError.label"));
      return;
    }

    let t = this;
    FireFM.Remote.grantAccess(
      aToken,
      function(aSuccess) { t.onGrantAccess(aToken, aSuccess); });
  },

  /**
   * Handles the response from the FireFM.Remote.grantAccess method. If access
   * is granted successfully, the authorization flow continues: getting an API
   * session.
   * @param aToken The generated API token for the user.
   * @param aSuccess Whether access was granted successfully.
   */
  onGrantAccess : function(aToken, aSuccess) {
    this._logger.debug("onGrantAccess");

    if (!aSuccess) {
      this._logger.error("Access could not be granted to Fire.fm");
      this._setMessage(this._bundle.getString("firefm.permissionError.label"));
      return;
    }

    let t = this;
    FireFM.Remote.authGetSession(
      aToken,
      function(aSession) { t.onGetSession(aSession); });
  },

  /**
   * Handles the response from the FireFM.Remote.authGetSession method. If a
   * valid session is returned, the account is stored using FireFM.Login and
   * the authorization flow finishes.
   * @param aSession The generated API session for the user.
   */
  onGetSession : function(aSession) {
    this._logger.debug("onGetSession");

    if (!aSession) {
      this._logger.error("API Session could not be obtained");
      this._setMessage(this._bundle.getString("firefm.permissionError.label"));
      return;
    }

    let username = document.getElementById("firefm-account-username").value;
    FireFM.Login.addUser(username, aSession);

    // Set window.arguments[0].success = true;
    // to let the caller know an account was added.
    if (window.arguments && window.arguments[0]) {
      window.arguments[0].success = true;
      window.arguments[0].username = username;
    }

    window.close();
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.AccountDialog.init(); }, false);
