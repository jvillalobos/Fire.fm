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
Components.utils.import("resource://firefm/fmPlayerInitializer.js");
Components.utils.import("resource://firefm/fmRemote.js");

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Error dialog controller. Loads the dialog with the error information and
 * sends the error report.
 */
FireFMChrome.ErrorDialog = {

  /* Logger for this object. */
  _logger : null,

  /* Comment textbox */
  _commentTextbox : null,
  /* Exception textbox */
  _exceptionTextbox : null,
  /* Email checkbox */
  _emailCheckbox : null,
  /* Email textbox */
  _emailTextbox : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFMChrome.ErrorDialog");
    this._logger.debug("init");

    this._commentTextbox =
      document.getElementById("firefm-error-comment-textbox");
    this._exceptionTextbox =
      document.getElementById("firefm-error-exception-textbox");
    this._emailCheckbox =
      document.getElementById("firefm-error-email-checkbox");
    this._emailTextbox =
      document.getElementById("firefm-error-email-textbox");

    // Load error info in the exception textbox
    let ex = FireFM.PlayerInitializer.initializationException;

    if (ex) {
      this._exceptionTextbox.value =
        "Name: " + ex.name + "\n" +
        "Message: " + ex.message + "\n" +
        "File Name: " + ex.fileName + "\n" +
        "Line Number: " + ex.lineNumber + "\n" +
        "Stack:\n" + ex.stack + "\n" +
        "User Agent: " + window.navigator.userAgent;
    } else {
      this._exceptionTextbox.value = "No error information available.";
    }
  },

  /**
   * Enables/disables the email address textbox. If the textbox is going to be
   * enabled and it contains the default message, its value is cleared.
   * @param aEnable Whether to enable (true) or disable (false) the textbox.
   */
  enableEmail : function(aEnable) {
    this._logger.debug("enableEmail");

    if (aEnable) {
      this._emailTextbox.removeAttribute("disabled");
      if (this._emailTextbox.getAttribute("hasDefaultLabel")) {
        this._emailTextbox.setAttribute("value", "");
        this._emailTextbox.removeAttribute("hasDefaultLabel");
      }
      this._emailTextbox.focus();
    } else {
      this._emailTextbox.setAttribute("disabled", true);
    }
  },

  /**
   * Sends the error report.
   */
  sendReport : function() {
    this._logger.debug("sendReport");

    let email = this._emailCheckbox.checked ? this._emailTextbox.value : "";

    let message =
      "Exception:\n" + this._exceptionTextbox.value + "\n\n" +
      "Email address: " + email + "\n\n" +
      "Comments:\n" + this._commentTextbox.value;

    // XXX: Gotta run it in a thread created by another window,
    // otherwise the request will not be sent.
    window.opener.setTimeout(
      function(aFireFMRemote, aMessage) {
        aFireFMRemote.sendPlayerLoadError(aMessage);
      },
      0, FireFM.Remote, message);
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.ErrorDialog.init(); }, false);
