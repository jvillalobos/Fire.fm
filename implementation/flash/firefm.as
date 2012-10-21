/*
Copyright (c) 2006, Gustavo Ribeiro Amigo
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
    * Neither the name of the author nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Compile with mtasc:
mtasc -main firefm.as -swf firefm.swf -header 450:325:20 -v -version 8 -group

*/

import flash.external.ExternalInterface;

class FireFMPlayer
{
   static var app:FireFMPlayer;
   var sound:Sound;

   static function main(mc:MovieClip) {
      app = new FireFMPlayer();

      System.security.allowDomain("resource://gre/res/hiddenWindow.html");
      System.security.allowDomain("chrome://browser/content/hiddenWindow.xul");
      System.security.allowDomain("chrome://navigator/content/hiddenWindow.xul");
      System.security.allowDomain("*");
   }

   function FireFMPlayer() {
     this._initSound();

     ExternalInterface.addCallback("loadSound", this, loadSound);
     ExternalInterface.addCallback("start", this, start);
     ExternalInterface.addCallback("stop", this, stop);
     ExternalInterface.addCallback("getDuration", this, getDuration);
     ExternalInterface.addCallback("getPosition", this, getPosition);
     ExternalInterface.addCallback("getVolume", this, getVolume);
     ExternalInterface.addCallback("setVolume", this, setVolume);
     ExternalInterface.addCallback("getPan", this, getPan);
     ExternalInterface.addCallback("setPan", this, setPan);
     ExternalInterface.addCallback("getBytesLoaded", this, getBytesLoaded);
     ExternalInterface.addCallback("getBytesTotal", this, getBytesTotal);
   }

   function _initSound() {
     this.sound = new Sound();
     this.sound.onLoad = this.onSoundLoad;
     this.sound.onSoundComplete = this.onSoundComplete;
   }

   /* Event notifications to javascript */
   function onSoundLoad(aSuccess:Boolean) {
       ExternalInterface.call("onFireFMSoundLoad", _root.id, aSuccess);
   }

   function onSoundComplete() {
      ExternalInterface.call("onFireFMSoundComplete", _root.id);
   }

   /* Called from javascript */
   function loadSound(aURL:String, aStream:Boolean) {
   	 this.sound.stop();
   	 this._initSound();
     this.sound.loadSound(aURL, aStream);
   }

   function start() {
     this.sound.start();
   }

   function stop() {
     this.sound.stop();
   }

   function getDuration():Object {
     return this.sound.duration;
   }

   function getPosition():Object {
     return this.sound.position;
   }

   function getVolume():Object {
     return this.sound.getVolume();
   }

   function setVolume(aValue:Number) {
     this.sound.setVolume(aValue);
   }

   function getPan():Object {
     return this.sound.getPan();
   }

   function setPan(aValue:Number) {
     this.sound.setPan(aValue);
   }

   function getBytesLoaded():Object {
     return this.sound.getBytesLoaded();
   }

   function getBytesTotal():Object {
     return this.sound.getBytesTotal();
   }
}
