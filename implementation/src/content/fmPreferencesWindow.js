/**
 * Copyright (c) 2008, Jose Enrique Bolanos, Jorge Villalobos
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
Components.utils.import("resource://firefm/fmLogin.js");

const Cc = Components.classes;
const Ci = Components.interfaces;

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Preferences window controller. Manages UI events that occur in the
 * preferences window.
 */
FireFMChrome.PreferencesWindow = {
  /* Regular expression used to extract the id for the status bar preference
     items. */
  _RE_STATUS_ID : /^([a-z\-]+)(\[[a-z]+\])?$/,
  /* Logger for this object. */
  _logger : null,
  /* The bradcaster that disables all statusbar-related items. */
  _statusbarBroadcaster : null,
  /* Indicates that the Fire.fm toolbar needs to be toggled when the dialog is
     accepted. */
  _mustToggleToolbar : false,
  /* Indicates that the Fire.fm statusbar preferences needs to be updated when
     the dialog is accepted. */
  _mustUpdateStatusbar : false,
  /* Temporary value of the statusbar buttons preference value, in case we need
     to set it once the window is accepted. */
  _statusbarButtons : null,

  /**
   * Initializes the object.
   */
  init : function() {
    let that = this;
    let os;

    this._logger = FireFM.getLogger("FireFMChrome.PreferencesWindow");
    this._logger.debug("init");

    os = FireFM.getOperatingSystem();

    if ((FireFM.OS_WINDOWS == os) || (FireFM.OS_WINDOWS_VISTA == os)) {
      document.title =
        FireFM.overlayBundle.GetStringFromName("firefm.options.title");
    } else {
      document.title =
        FireFM.overlayBundle.GetStringFromName("firefm.optionsUnix.title");
    }

    // set the state for all statusbar related items.
    this._statusbarBroadcaster =
      document.getElementById("firefm-statusbar-broadcaster");
    this.toggleStatusChecks();
    this.updateStatusbarChecks();

    // set the toolbar visibility checkbox value.
    document.getElementById("firefm-show-toolbar").checked =
      this._getToolbarVisibility();

    // load the account list
    this._loadAccounts();
  },

  /**
   * Unloads the object.
   */
  uninit : function() {
    this._logger.debug("uninit");
  },

  /**
   * Opens the Scrobble page on a browser window.
   * @param aEvent the event that triggered this action.
   */
  openScrobblePage : function(aEvent) {
    this._logger.debug("openScrobblePage");
    openURL(FireFM.Remote.URL_SCROBBLE_HELP);
  },

  /**
   * Opens the mouse gestures page on a browser window.
   * @param aEvent the event that triggered this action.
   */
  openGesturesPage : function(aEvent) {
    this._logger.debug("openGesturesPage");
    openURL(FireFM.Remote.URL_GESTURES_HELP);
  },

  /**
   * Clears the recent station history.
   * @param aEvent the event that triggered this action.
   */
  clearRecentHistory : function(aEvent) {
    this._logger.debug("clearRecentHistory");
    // disable the button, since it will no longer do anything.
    aEvent.target.setAttribute("disabled", true);
    FireFM.History.clearRecentHistory();
  },

  /**
   * Clears the Fire.fm entries in the browser history.
   * @param aEvent the event that triggered this action.
   */
  clearPlacesHistory : function(aEvent) {
    this._logger.debug("clearPlacesHistory");

    // disable the button, since it will no longer do anything.
    aEvent.target.setAttribute("disabled", true);

    // XXX: This method may take a while, depending on the amount of history
    // entries, so it's best to run it in a new thread created by the opener
    // window.
    window.opener.setTimeout(
      function() { FireFM.History.clearPlacesHistory(); }, 0);
  },

  /**
   * Toggles the visibility of the Fire.fm toolbar on all active windows.
   * @param aEvent the event that triggered this action.
   */
  toggleToolbar : function(aEvent) {
    this._logger.debug("toggleToolbar");

    // this preference determines if changes in preference windows should apply
    // right away, or if they should apply when the window is accepted.
    let instantApplyPref =
      FireFM.Application.prefs.get("browser.preferences.instantApply");

    if (instantApplyPref.value) {
      this._toggleToolbar();
    } else {
      this._mustToggleToolbar = true;
    }
  },

  /**
   * Carries away any actions necessary when the window is closed.
   * @param aEvent the event that triggered this action.
   */
  accept : function(aEvent) {
    this._logger.debug("accept");

    if (this._mustToggleToolbar) {
      this._toggleToolbar();
    }

    if (this._mustUpdateStatusbar) {
      this._customizeStatusbar();
    }
  },

  /**
   * Gets the current state of visibility of the Fire.fm toolbar.
   * XXX: this may be a little buggy because it depends on the state of the most
   * recent window. Is that always the same as the persisted value?
   * @return true if the toolbar is currently visible, false otherwise.
   */
  _getToolbarVisibility : function() {
    this._logger.trace("_getToolbarVisibility");

    let win =
      Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator).
          getMostRecentWindow("navigator:browser");
    let visible = true; // this is the most sensible default.

    if (null != win) {
      visible = !win.document.getElementById("firefm-toolbar").collapsed;
    } else {
      this._logger.error("_getToolbarVisibility: No browser window found!");
    }

    return visible;
  },

  /**
   * Sets the visibility for the toolbar in all opened browser windows, and sets
   * the persistence of it.
   * XXX: this won't work if there is no browser window open.
   */
  _toggleToolbar : function() {
    this._logger.trace("_toggleToolbar");

    let winMediator =
      Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);
    let browserWins = winMediator.getEnumerator("navigator:browser");
    let shouldShow = document.getElementById("firefm-show-toolbar").checked;
    let win = null;
    let toolbar;

    while (browserWins.hasMoreElements()) {
      win = browserWins.getNext();
      toolbar = win.document.getElementById("firefm-toolbar");
      toolbar.collapsed = !shouldShow;
      win.document.persist("firefm-toolbar", "collapsed");
    }

    if (null == win) {
      this._logger.error("_toggleToolbar: No browser window found!");
    }
  },

  /**
   * Updates the disabled/enabled state of the checkboxes that are related to
   * the statusbar preference.
   * @param aEvent the event that triggered this action.
   */
  toggleStatusChecks : function(aEvent) {
    this._logger.debug("toggleStatusChecks");

    let statusPref =
      document.getElementById("firefm-preference-show-statusbar");

    if (statusPref.value) {
      this._statusbarBroadcaster.removeAttribute("disabled");
    } else {
      this._statusbarBroadcaster.setAttribute("disabled", true);
    }
  },

  /**
   * Updates the checkboxes for the statusbar preference according to its
   * current value.
   * @param aEvent the event that triggered this action.
   */
  updateStatusbarChecks : function(aEvent) {
    this._logger.debug("updateStatusbarChecks");

    let statusButtonsPref =
      document.getElementById("firefm-preference-statusbar-buttons");
    let buttonsStr = statusButtonsPref.value;
    let buttons = ((null != buttonsStr) ? buttonsStr.split(",") : [ ]);
    let buttonMatch;
    let check;

    this._statusbarBroadcaster.setAttribute("checked", false);

    for (let i = 0; i < buttons.length; i++) {
      buttonMatch = this._RE_STATUS_ID.exec(buttons[i]);

      if (null != buttonMatch) {
        check = document.getElementById(buttonMatch[1]);

        if (null != check) {
          check.checked = true;

          if ("firefm-status-track-info" == check.id) {
            let infoSize =
              document.getElementById("firefm-status-track-info-size");

            infoSize.checked =
              ((2 >= buttonMatch.length) || ("[large]" != buttonMatch[2]));
          }
        }
      }
    }
  },

  /**
   * Updates the statusbar buttons preference. This change may not apply
   * immediately because of a system preference that says preferences must not
   * apply until the window is accepted.
   * @param aEvent the event that triggered this action.
   */
  customizeStatusbar : function(aEvent) {
    this._logger.debug("customizeStatusbar");

    // this preference determines if changes in preference windows should apply
    // right away, or if they should apply when the window is accepted.
    let instantApplyPref =
      FireFM.Application.prefs.get("browser.preferences.instantApply");
    let container = document.getElementById("firefm-status-check-container");
    let checks = container.getElementsByTagName("checkbox");
    let first = true;
    let check = null;

    this._statusbarButtons = "";

    for (let i = 0; i < checks.length; i++) {
      check = checks[i];

      if (check.checked) {
        if (!first) {
          this._statusbarButtons += ",";
        } else {
          first = false;
        }

        this._statusbarButtons += check.id;

        if ("firefm-status-track-info" == check.id) {
          let infoSize =
            document.getElementById("firefm-status-track-info-size");

          this._statusbarButtons +=
            ((infoSize.checked) ? "[small]" : "[large]");
        }
      }
    }

    if (instantApplyPref.value) {
      this._customizeStatusbar();
    } else {
      this._mustUpdateStatusbar = true;
    }
  },

  /**
   * Updates the statusbar buttons preference.
   * @param aEvent the event that triggered this action.
   */
  _customizeStatusbar : function(aEvent) {
    this._logger.trace("_customizeStatusbar");

    let statusButtonsPref =
      document.getElementById("firefm-preference-statusbar-buttons");

    statusButtonsPref.valueFromPreferences = this._statusbarButtons;
  },

  /**
   * Loads the user list (Accounts pane).
   */
  _loadAccounts : function() {
    this._logger.trace("_loadAccounts");

    let userList = FireFM.Login.userList;
    let listbox = document.getElementById("firefm-accounts-list");

    // clear the list
    while (listbox.getRowCount() > 0) {
      listbox.removeItemAt(0);
    }
    // fill the list
    for (let i = 0; i < userList.length; i++) {
      listbox.appendItem(userList[i]);
    }
  },

  /**
   * Enables or disables the "Remove Account" button depending on whether an
   * account is selected in the list.
   */
  updateRemoveAccountButton : function() {
    this._logger.debug("updateRemoveAccountButton");

    let listbox = document.getElementById("firefm-accounts-list");
    let removeButton = document.getElementById("firefm-accounts-remove");

    if (listbox.selectedItem)
      removeButton.removeAttribute("disabled");
    else
      removeButton.setAttribute("disabled", true);
  },

  /**
   * Removes the currently selected account from the list.
   */
  removeAccount : function() {
    this._logger.debug("removeAccount");

    let listbox = document.getElementById("firefm-accounts-list");
    if (!listbox.selectedItem)
      return;

    let username = listbox.selectedItem.label;

    let promptService =
      Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Components.interfaces.nsIPromptService);
    let confirmationTitle =
      FireFM.overlayBundle.GetStringFromName("firefm.removeAccount.title");
    let confirmationLabel =
      FireFM.overlayBundle.
        formatStringFromName("firefm.removeAccount.label", [username], 1);

    if (promptService.confirm(window, confirmationTitle, confirmationLabel)) {
      if (FireFM.Login.userName == username) {
        FireFM.Login.logout();
      }

      FireFM.Login.removeUser(username);
      this._loadAccounts();
      this.updateRemoveAccountButton();
    }
  },

  /**
   * Opens the "Add Account" dialog to add an account.
   */
  addAccount : function() {
    this._logger.debug("addAccount");

    let result = { success : false };

    window.openDialog(
      "chrome://firefm/content/fmAccountDialog.xul",
      "firefm-account-dialog",
      "chrome,titlebar,toolbar,centerscreen,dialog,modal,resizable=no",
      result);

    if (result.success) {
      this._loadAccounts();
      this.updateRemoveAccountButton();
    }
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.PreferencesWindow.init(); }, false);
window.addEventListener(
  "unload", function() { FireFMChrome.PreferencesWindow.uninit(); }, false);
