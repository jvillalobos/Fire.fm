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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://firefm/fmCommon.js");

// URL templates used to generate special Last.fm station URLs.
const STATION_URL_ARTIST = "lastfm://artist/$(ARTIST)/similarartists";
const STATION_URL_RECOMMENDED = "lastfm://user/$(USER)/recommended";
const STATION_URL_USER = "lastfm://user/$(USER)/personal";
const STATION_URL_TAG = "lastfm://globaltags/$(TAG)";
const STATION_URL_NEIGHBORHOOD = "lastfm://user/$(USER)/neighbours";

/**
 * Station info object. Represents a Last.FM station.
 */
FireFM.StationInfo = function(aId, aType) {
  this._logger = FireFM.getLogger("FireFM.StationInfo");
  this._logger.debug("init");

  this._id = FireFM.decodeFMString(aId);
  this._type = aType;

  switch (aType) {
    case FireFM.Station.TYPE_ARTIST:
      this._title =
        FireFM.overlayBundle.formatStringFromName(
          "firefm.station.artist.label", [ this._id ], 1);
      break;
    case FireFM.Station.TYPE_RECOMMENDED:
      this._title =
        FireFM.overlayBundle.formatStringFromName(
          "firefm.station.recommended.label", [ this._id ], 1);
      break;
    case FireFM.Station.TYPE_USER:
      this._title =
        FireFM.overlayBundle.formatStringFromName(
          "firefm.station.user.label", [ this._id ], 1);
      break;
    case FireFM.Station.TYPE_TAG:
      this._title =
        FireFM.overlayBundle.formatStringFromName(
          "firefm.station.tag.label", [ this._id ], 1);
      break;
    case FireFM.Station.TYPE_NEIGHBORHOOD:
      this._title =
        FireFM.overlayBundle.formatStringFromName(
          "firefm.station.neighborhood.label", [ this._id ], 1);
      break;
  }
};

/**
 * StationInfo object methods.
 */
FireFM.StationInfo.prototype = {
  /* Private copy of the id. */
  _id : null,
  /* Private copy of the station type. */
  _type : null,
  /* Private copy of the title. */
  _title : null,

  /* Gets the station id. */
  get id() { return this._id; },

  /* Gets the station type. */
  get type() { return this._type; },

  /* Gets the station title. */
  get title() { return this._title; },

  /**
   * Gets the wrapped inner object.
   * XXX: this is a workaround so I can pass this object through an observer
   * without having to explicitly declare an interface for it.
   * http://www.mail-archive.com/dev-tech-xpcom@lists.mozilla.org/msg01505.html
   */
  get wrappedJSObject() { return this; },

  /**
   * Generates a special type of URL that Last.fm handles for stations.
   * @return the special URL that corresponds to this station.
   */
  getStationURL : function() {
    this._logger.debug("getStationURL");

    let url = null;

    switch (this.type) {
      case FireFM.Station.TYPE_ARTIST:
        url =
          STATION_URL_ARTIST.replace(
            /\$\(ARTIST\)/, encodeURIComponent(this.id));
        break;
      case FireFM.Station.TYPE_RECOMMENDED:
        url =
          STATION_URL_RECOMMENDED.replace(
            /\$\(USER\)/, encodeURIComponent(this.id));
        break;
      case FireFM.Station.TYPE_USER:
        url =
          STATION_URL_USER.replace(/\$\(USER\)/, encodeURIComponent(this.id));
        break;
      case FireFM.Station.TYPE_TAG:
        url = STATION_URL_TAG.replace(/\$\(TAG\)/, encodeURIComponent(this.id));
        break;
      case FireFM.Station.TYPE_NEIGHBORHOOD:
        url =
          STATION_URL_NEIGHBORHOOD.replace(
            /\$\(USER\)/, encodeURIComponent(this.id));
        break;
    }

    return url;
  },

  /**
   * Returns the JSON representation of this object.
   * @returns JSON representation of this object.
   */
  toJSON : function() {
    this._logger.debug("toJSON");

    let that = this;
    let jsonObj =
      { id : that._id, type : that._type, title : that._title };

    return JSON.stringify(jsonObj);
  },

  /**
   * We need to pass tracks through observers, so we implement nsISupports.
   */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports])
};

/**
 * Track object. Represents a Last.FM track.
 */
FireFM.Track = function(
  aId, aLocation, aTitle, aRecording, aAlbumTitle, aArtist, aDuration,
  aImagePath, aTrackAuth, aAlbumId, aArtistId, aArtistURL, aAlbumURL, aTrackURL,
  aBuyTrackURL, aBuyAlbumURL, aFreeTrackURL) {
  // Amazon URL, generated from:
  // https://affiliate-program.amazon.com/gp/associates/network/build-links/text/main.html
  const AMAZON_URL =
    "http://www.amazon.com/gp/search?" +
    "ie=UTF8&tag=firefm-20&index=blended&linkCode=ur2&camp=1789&creative=9325&keywords=";

  this.id = aId;
  this.location = aLocation;
  this.title = aTitle;
  this.recording = aRecording;
  this.albumTitle = aAlbumTitle;
  this.artist = aArtist;
  this.duration = aDuration;
  this.imagePath = aImagePath;
  this.trackAuth = aTrackAuth;
  this.albumId = aAlbumId;
  this.artistId = aArtistId;
  this.artistURL = aArtistURL.trim();
  this.albumURL = aAlbumURL.trim();
  this.trackURL = aTrackURL.trim();
  this.buyTrackURL = aBuyTrackURL.trim();
  this.buyAlbumURL = aBuyAlbumURL.trim();
  this.freeTrackURL = aFreeTrackURL.trim();
  // The time the track began playing.
  this.startTime = -1;
  this.amazonURL = AMAZON_URL + encodeURIComponent(aArtist + " " + aTitle);
};

/**
 * Track object methods.
 */
FireFM.Track.prototype = {
  /**
   * Gets the wrapped inner object.
   * XXX: this is a workaround so I can pass this object through an observer
   * without having to explicitly declare an interface for it.
   * http://www.mail-archive.com/dev-tech-xpcom@lists.mozilla.org/msg01505.html
   */
  get wrappedJSObject() {
    return this;
  },

  /**
   * We need to pass tracks through observers, so we implement nsISupports.
   */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports])
};

/**
 * Feed item used for feed displays.
 */
FireFM.FeedItem = function(aName, aURL, aImagePath) {
  this.name = aName;
  this.url = aURL;
  this.imagePath = aImagePath;
};
