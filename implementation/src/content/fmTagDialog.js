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
Components.utils.import("resource://firefm/fmRemote.js");

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Tag dialog controller..
 */
FireFMChrome.TagDialog = {

  /* Logger for this object. */
  _logger : null,
  /* Track to be tagged */
  _track : null,
  /* Contains all old tags by type */
  _oldTags : {},

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFMChrome.TagDialog");
    this._logger.debug("init");

    // set the document title
    if (FireFM.OS_MAC == FireFM.getOperatingSystem()) {
      let titleElem = document.getElementById("info.title");

      titleElem.value =
        FireFM.overlayBundle.GetStringFromName("firefm.tagDialog.title");
      titleElem.hidden = false;
    } else {
      document.title =
        FireFM.overlayBundle.GetStringFromName("firefm.tagDialog.title");
    }

    this._track = window.arguments[0].track;
    // Disable option to tag album if the track has no album info.
    if (0 >= this._track.albumTitle.length) {
      document.getElementById("fm-tag-type-album").
        setAttribute("disabled", true);
    }

    this.loadExistingTags();
    this.setTagTypeUI();

    getAttention();
    document.getElementById(
      "fm-tag-textbox-" + FireFM.Remote.TAG_TYPE_TRACK).focus();
  },

  /**
   * Makes calls using FireFM.Remote to load the existing tags for each tag
   * type (artist, track, album).
   */
  loadExistingTags : function() {
    this._logger.debug("loadExistingTags");

    let that = this;

    this._oldTags[String(FireFM.Remote.TAG_TYPE_TRACK)] = [];
    FireFM.Remote.getTags(this._track, FireFM.Remote.TAG_TYPE_TRACK,
      function(aTags) {
        that._loadExistingTagsCallback(
          aTags, FireFM.Remote.TAG_TYPE_TRACK); } );

    this._oldTags[String(FireFM.Remote.TAG_TYPE_ARTIST)] = [];
    FireFM.Remote.getTags(this._track, FireFM.Remote.TAG_TYPE_ARTIST,
      function(aTags) {
        that._loadExistingTagsCallback(
          aTags, FireFM.Remote.TAG_TYPE_ARTIST); } );

    this._oldTags[String(FireFM.Remote.TAG_TYPE_ALBUM)] = [];
    if (0 < this._track.albumTitle.length) {
      FireFM.Remote.getTags(this._track, FireFM.Remote.TAG_TYPE_ALBUM,
        function(aTags) {
          that._loadExistingTagsCallback(
            aTags, FireFM.Remote.TAG_TYPE_ALBUM); } );
    }
  },

  /**
   * Callback handler for the loadExistingTags method. Loads the tags in the
   * respective textbox, according to the tag type.
   * @param aTags The array of existing tags.
   * @param aTagType The type of the existing tags (artist, track or album).
   */
  _loadExistingTagsCallback : function(aTags, aTagType) {
    this._logger.trace("_loadExistingTags");

    this._oldTags[String(aTagType)] = aTags;

    let tags = aTags.toString().replace(/,/g, ", ");
    if (0 < tags.length) {
      tags += ", ";
    }

    let tagsTextbox = document.getElementById("fm-tag-textbox-" + aTagType);
    tagsTextbox.value = tags + tagsTextbox.value;
  },

  /**
   * Obtains the tags of the current textbox according to the selected tag type.
   * @return The array of tags in the current, visible textbox.
   */
  _getNewTags : function() {
    this._logger.trace("_getNewTags");

    let tagType = document.getElementById("fm-tag-type").value;
    let tagsField = document.getElementById("fm-tag-textbox-" + tagType);
    let tags = tagsField.value.split(",");

    for (let i = 0; i < tags.length; i++) {
      tags[i] = tags[i].trim();
    }

    return tags;
  },

  /**
   * Obtains the old tags that were removed form the textbox, according to
   * the selected tag type.
   * @return The array of tags that were removed.
   */
  _getRemovedTags : function() {
    this._logger.trace("_getRemovedTags");

    let removedTags = [];
    let tagType = document.getElementById("fm-tag-type").value;
    let oldTags = this._oldTags[String(tagType)];
    let newTags = this._getNewTags();

    let found;
    for (let i = 0; i < oldTags.length; i++) {
      found = false;

      for (let j = 0; j < newTags.length; j++) {
        if (oldTags[i].toLowerCase() == newTags[j].toLowerCase()) {
          found = true;
          break;
        }
      }

      if (!found) {
        removedTags.push(oldTags[i]);
      }
    }

    return removedTags;
  },

  /**
   * Sets the UI of the dialog according to the selected tag type.
   */
  setTagTypeUI : function() {
    this._logger.debug("setTargetLabel");

    let target = document.getElementById("fm-tag-target");
    let textboxDeck = document.getElementById("fm-tag-textbox-deck");
    let tagType = parseInt(document.getElementById("fm-tag-type").value);

    switch (tagType) {
      case FireFM.Remote.TAG_TYPE_ARTIST:
        target.setAttribute("value", this._track.artist);
        textboxDeck.setAttribute("selectedIndex", 0);
        break;
      case FireFM.Remote.TAG_TYPE_TRACK:
        target.setAttribute("value",
          this._track.artist + " - " + this._track.title);
        textboxDeck.setAttribute("selectedIndex", 1);
        break;
      case FireFM.Remote.TAG_TYPE_ALBUM:
        target.setAttribute("value",
          this._track.artist + " - " + this._track.albumTitle);
        textboxDeck.setAttribute("selectedIndex", 2);
        break;
    }
  },

  /**
   * Sets the return object values (tags and tag type).
   */
  setTags : function() {
    this._logger.debug("setTags");

    let returnObj = window.arguments[0];

    returnObj.newTags = this._getNewTags();
    returnObj.removedTags = this._getRemovedTags();
    returnObj.type = parseInt(document.getElementById("fm-tag-type").value);
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.TagDialog.init(); }, false);
