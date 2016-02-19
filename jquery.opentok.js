/*
 * OpenTok plugin for jQuery JavaScript Library
 *
 * Copyright (c) 2011, Jose M Torres
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function($){
  if(!$.openTok){
    $.openTok = { };
  }

  $.fn.openTok = function( options ) {
    var name = "openTok";
    var isMethodCall = typeof options === "string",
      args = Array.prototype.slice.call( arguments, 1 ),
      returnValue = this;

    // allow multiple hashes to be passed on init
    options = !isMethodCall && args.length ?
      $.extend.apply( null, [ true, options ].concat(args) ) :
      options;

    // prevent calls to internal methods
    if ( isMethodCall && options.charAt( 0 ) === "_" ) {
      return returnValue;
    }

    if ( isMethodCall ) {
      this.each(function() {
        var instance = $.data( this, name ),
          methodValue = instance && $.isFunction( instance[options] ) ?
            instance[ options ].apply( instance, args ) :
            instance;
        if ( methodValue !== instance && methodValue !== undefined ) {
          returnValue = methodValue;
          return false;
        }
      });
    } else {
      this.each(function() {
        var instance = $.data( this, name );
        if ( instance ) {
          // instance.option( options || {} )._init(); // Orig jquery.ui.widget.js code: Not recommend for openTok. ie., Applying new options to an existing instance (via the openTok constructor) and performing the _init(). The _init() is what concerns me. It would leave a lot of event handlers acting on openTok instance and the interface.
          instance.option( options || {} ); // The new constructor only changes the options. Changing options only has basic support atm.
        } else {
          $.data( this, name, new $.openTok( options, this ) );
        }
      });
    }

    return returnValue;
  };

  $.openTok = function( options, element ) {
    // allow instantiation without initializing for simple inheritance
    if ( arguments.length ) {
      this.element = $(element);
      this.options = $.extend(true, {},
        this.options,
        options
      );
      var self = this;
      this.element.bind( "remove.openTok", function() {
        self.destroy();
      });
      this._init();
    }
  };

  $.openTok.event = {
    sessionConnected: "openTok_sessionConnected",
    sessionDisconnected: "openTok_sessionDisconnected",
    connectionCreated: "openTok_connectionCreated",
    connectionDestroyed: "openTok_connectionDestroyed",
    streamCreated: "openTok_streamCreated",
    streamDestroyed: "openTok_streamDestroyed",
    streamAdded: "openTok_streamAdded",
    streamRemoved: "openTok_streamRemoved",
    publish: "openTok_publish",
    unpublish: "openTok_unpublish",
    containerResize: "openTok_containerResize",
  };
  
  $.openTok.publisherEvent = {
    accessAllowed: "openTok_accessAllowed",
    accessDenied: "openTok_accessDenied",
    deviceInactive: "openTok_deviceInactive",
    resize: "openTok_resize",
    settingsButtonClick: "openTok_settingsButtonClick",
  };
  
  $.openTok.logLevel = {
    none: OT.NONE,
    error: OT.ERROR,
    warn: OT.WARN,
    info: OT.INFO,
    debug: OT.DEBUG,
  };

  $.openTok.prototype = {
    count: 0,
    options: {
      apiKey: "",
      sessionId: "",
      connectionToken: "devtoken",
      logLevel: $.openTok.logLevel.none,
      autoConnect: false,
      autoPublish: false,
      pushTalk: true,
      publishProperties: {},
      cssSelectorAncestor: ".opentok-container",
      cssSelector: {
        connect: ".opentok-connect",
        disconnect: ".opentok-disconnect",
        publish: ".opentok-publish",
        unpublish: ".opentok-unpublish",
        pushTalkMode: ".opentok-push-talk-mode",
        pushTalkToggle: ".opentok-push-talk-toggle",
        streamsContainer: ".opentok-streams",
        publisherWrapper: ".opentok-publisher-wrapper",
        publisherContainer: ".opentok-publisher",
      },
      streamCssSelector: {
        close: ".opentok-close",
        mute: ".opentok-mute",
        unmute: ".opentok-unmute",
        muteToggle: ".opentok-mute-toggle",
        forceUnpublish: ".opentok-force-unpublish",
        forceDisconnect: ".opentok-force-disconnect",
        streamWrapper: ".opentok-stream-wrapper",
        streamContainer: ".opentok-stream",
      },
      idPrefix: "ot",
      streamWrapper: '<div class="opentok-stream"><a href="#" class="opentok-mute">Mute</a><a href="#" class="opentok-unmute">Unmute</a><a href="#" class="opentok-close">Close</a></div>',
    },
    instances: {},
    status: {
      connected: false,
      publishing: false,
      pushTalking: false,
    },
    internal: {
      instance: undefined,
    },
    session: {},
    publisher: {},
    streams: {},
    _init: function(){
      var self = this;

      this.status = $.extend({}, this.status); // Copy static to unique instance.
      this.internal = $.extend({}, this.internal); // Copy static to unique instance.
      
      this.css = {};
      this.css.cs = {}; // Holds the css selector strings
      this.css.jq = {}; // Holds jQuery selectors. ie., $(css.cs.method)

      this.streams = {};

      //this.status = {};

      this.ancestorJq = this.options.cssSelectorAncestor ? $(this.options.cssSelectorAncestor) : []; // Would use $() instead of [], but it is only 1.4+

      this.internal.instance = "ot_" + this.count;
      this.instances[this.internal.instance] = this.element;

      if(this.element.attr("id") === "") {
        this.element.attr("id", this.options.idPrefix + "_opentok_" + this.count);
      }

      this.internal.self = $.extend({}, {
        id: this.element.attr("id"),
        jq: this.element
      });

      OT.setLogLevel(this.options.logLevel);
      this.session = OT.initSession(this.options.apiKey, this.options.sessionId);

      $.each($.openTok.event, function(eventName,eventType) {
        if(self.options[eventName] !== undefined) {
          self.element.bind(eventType + ".openTok", self.options[eventName]); // With .openTok namespace.
          self.options[eventName] = undefined; // Destroy the handler pointer copy on the options. Reason, events can be added/removed in other ways so this could be obsolete and misleading.
        }
      });

      $.each(this.options.cssSelector, function(fn, cssSel) {
        self._cssSelector(fn, cssSel, self.internal.self.jq);
      });
      
      this.css.jq['streamsContainer'].bind("resize.openTok", function(e) {
        self._trigger($.openTok.event.containerResize, e);
      }); // Using openTok namespace

      this._addHtmlEventListeners(this.session);

      this._updateButtons();

      if(this.options.autoConnect){
        this.connect();
      }

      $.openTok.prototype.count++;
    },
    _addHtmlEventListeners: function(session) {
      var self = this;

      // Create the event listeners
      session.addEventListener("sessionConnected", function(e) {
        for(var i = 0; i < e.streams.length; i++){
          self._addStream(e.streams[i]);
        }
        self.status.connected = true;
        self._updateButtons();

        self._trigger($.openTok.event.sessionConnected, e);
        if(self.options.autoPublish){
          self.publish();
        }
      });
      session.addEventListener("sessionDisconnected", function(e) {
        e.preventDefault();
        for (x in self.streams){
          self._removeStream(self.streams[x].subscriber.stream);
        }
        if(self.status.publishing){
          self.unpublish();
        }
        self.status.connected = false;
        //self.status.publishing = false;
        
        self._updateButtons();

        self._trigger($.openTok.event.sessionDisconnected, e);
      });
      session.addEventListener("connectionCreated", function(e) {
        self._trigger($.openTok.event.connectionCreated, e);
      });
      session.addEventListener("connectionDestroyed", function(e) {
        self._trigger($.openTok.event.connectionDestroyed);
      });
      session.addEventListener("streamCreated", function(e) {
        for(var i = 0; i < e.streams.length; i++){
          self._addStream(e.streams[i]);
        }
        self._trigger($.openTok.event.streamCreated, e);
      });
      session.addEventListener("streamDestroyed", function(e) {
        e.preventDefault();
        for(var i = 0; i < e.streams.length; i++){
          self._removeStream(e.streams[i]);
        }
        self._trigger($.openTok.event.streamDestroyed, e);
      });
    },
    _addPublisherEventListeners: function(publisher){
      var self = this;
      
      publisher.addEventListener("accessAllowed", function(e){
        self._trigger($.openTok.publisherEvent.accessAllowed, e);
      }); 
      publisher.addEventListener("accessDenied", function(e){
        self._trigger($.openTok.publisherEvent.accessDenied, e);
      }); 
      publisher.addEventListener("deviceInactive", function(e){
        self._trigger($.openTok.publisherEvent.deviceInactive, e);
      }); 
      publisher.addEventListener("resize", function(e){
        self._trigger($.openTok.publisherEvent.resize, e);
      }); 
      publisher.addEventListener("settingsButtonClick", function(e){ 
        self._trigger($.openTok.publisherEvent.settingsButtonClick, e);
      }); 
    },
    _trigger: function(eventType, eventData) { // eventType always valid as called using $.openTok.event.eventType
      var event = $.Event(eventType);
      event.openTok = {};
      event.openTok.status = $.extend(true, {}, this.status); // Deep copy
      event.openTok.eventData = eventData;
      event.openTok.element = this.element;
      this.element.trigger(event);
    },
    _cssSelector: function(fn, cssSel, context) {
      var self = this;
      if(typeof cssSel === 'string') {
        if($.openTok.prototype.options.cssSelector[fn]) {
          if(this.css.jq[fn] && this.css.jq[fn].length) {
            this.css.jq[fn].unbind(".openTok");
          }
          this.options.cssSelector[fn] = cssSel;
          this.css.cs[fn] = /*this.options.cssSelectorAncestor + " " +*/ cssSel;

          if(cssSel) { // Checks for empty string
            this.css.jq[fn] = $(this.css.cs[fn], context);
          } else {
            this.css.jq[fn] = []; // To comply with the css.jq[fn].length check before its use. As of jQuery 1.4 could have used $() for an empty set. 
          }

          if(this.css.jq[fn].length) {
            /*var handler = function(e) {
              self[fn](e);
              $(this).blur();
              return false;
            }
            this.css.jq[fn].bind("click.openTok", handler); // Using openTok namespace*/
            if($.isFunction(self[fn])){
              this.css.jq[fn].bind("click.openTok", function(e) {
                self[fn](e);
                $(this).blur();
                return false;
              }); // Using openTok namespace
            }
            if($.isFunction(self[fn + 'Down'])){
              this.css.jq[fn].bind("mousedown.openTok", function(e) {
                self[fn + 'Down'](e);
                $(this).blur();
                return false;
              }); // Using openTok namespace
            }
            if($.isFunction(self[fn + 'Up'])){
              this.css.jq[fn].bind("mouseup.openTok", function(e) {
                self[fn + 'Up'](e);
                $(this).blur();
                return false;
              }); // Using openTok namespace
            }
            
          }
        }
      }
    },
    _streamCssSelector: function(fn, cssSel, context, parent) {
      var self = this;
      if(typeof cssSel === 'string') {
        if($.openTok.prototype.options.streamCssSelector[fn]) {
          if(parent.css.jq[fn] && parent.css.jq[fn].length) {
            parent.css.jq[fn].unbind(".openTok");
          }
          this.options.streamCssSelector[fn] = cssSel;
          parent.css.cs[fn] = /*this.options.cssSelectorAncestor + " " +*/ cssSel;

          if(cssSel) { // Checks for empty string
            parent.css.jq[fn] = $(parent.css.cs[fn], context);
          } else {
            parent.css.jq[fn] = []; // To comply with the css.jq[fn].length check before its use. As of jQuery 1.4 could have used $() for an empty set. 
          }

          if(parent.css.jq[fn].length) {
            var handler = function(e) {
              self[fn](e, parent);
              $(this).blur();
              return false;
            }
            parent.css.jq[fn].bind("click.openTok", handler); // Using openTok namespace
          }
        }
      }
    },
    _addStream: function(stream){
      var self = this;
      if(!this.session.capabilities.subscribe || stream.connection.connectionId == this.session.connection.connectionId){
        return;
      }

      var streamOptions = {
        subscribeToAudio: !this.status.pushTalking,
      };

      var streamId = this.options.idPrefix + "_opentok_stream_" + stream.streamId;
      
      var streamWrapper;
      if($.isFunction(this.options.streamWrapper)){
        streamWrapper = $(this.options.streamWrapper(this.session, stream));
      }
      else{
        streamWrapper = $(this.options.streamWrapper);
      }
      
      var streamWrapperContainer = $('<div/>').attr("id", streamId).append(streamWrapper);
      
      $(this.options.streamCssSelector.streamContainer, streamWrapperContainer).append($('<div/>').attr("id", streamId + "_stream"));

      this.css.jq.streamsContainer.append(streamWrapperContainer);
      this.streams[stream.streamId] = {};
      this.streams[stream.streamId].css = {};
      this.streams[stream.streamId].css.cs = {}; // Holds the css selector strings
      this.streams[stream.streamId].css.jq = {};
      this.streams[stream.streamId].subscriber = this.session.subscribe(stream, streamId + "_stream", streamOptions);
      this.streams[stream.streamId].jq = streamWrapperContainer;
      $.each(this.options.streamCssSelector, function(fn, cssSel) {
        self._streamCssSelector(fn, cssSel, self.streams[stream.streamId].jq, self.streams[stream.streamId]);
      });
      
      this._updateStreamButtons(stream);
      this._trigger($.openTok.event.streamAdded, stream);
    },
    _removeStream: function(stream){
      if(this.streams[stream.streamId]){
        this.streams[stream.streamId].jq.remove();
        delete this.streams[stream.streamId];
        this._trigger($.openTok.event.streamRemoved, stream);
      }
      else if(this.status.publishing && this.publisher.properties.connectionId == stream.connection.connectionId){
        delete this.publisher;
        this.status.publishing = false;
        this._updateButtons();
        this._trigger($.openTok.event.unpublish);
        this._trigger($.openTok.event.streamRemoved, stream);
      }
    },
    _updateButtons: function(){
      this.css.jq.connect.toggle(!this.status.connected);
      this.css.jq.disconnect.toggle(this.status.connected);
      this.css.jq.publish.toggle(this.status.connected && Boolean(this.session.capabilities.publish) && !this.status.publishing);
      this.css.jq.unpublish.toggle(this.status.connected && this.status.publishing);
      this.css.jq.publisherWrapper.toggle(this.status.publishing);
      this.css.jq.pushTalkMode.toggle(this.status.publishing);
      this.css.jq.pushTalkMode.toggleClass('pushTalkEnabled', this.options.pushTalk);
      this.css.jq.pushTalkToggle.toggle(this.status.publishing && this.options.pushTalk);
    },
    _updateStreamButtons: function(stream){
      this.streams[stream.streamId].css.jq.mute.toggle(!this.streams[stream.streamId].muted);
      this.streams[stream.streamId].css.jq.unmute.toggle(this.streams[stream.streamId].muted);
      this.streams[stream.streamId].css.jq.muteToggle.toggleClass('muted', this.streams[stream.streamId].muted);
      this.streams[stream.streamId].css.jq.forceUnpublish.toggle(Boolean(this.session.capabilities.forceUnpublish));
      this.streams[stream.streamId].css.jq.forceDisconnect.toggle(Boolean(this.session.capabilities.forceDisconnect));
    },
    connect: function(e){
      try {
        this.session.connect(this.options.connectionToken);
      }
      catch(err) {
        alert(err);
      }      
    },
    disconnect: function(e){
      this.session.disconnect();
    },
    publish: function(e){
      try{
        if(this.status.connected && this.session.capabilities.publish){
          var publisherId = this.options.idPrefix + "_opentok_" + this.count + "_publisher";
          this.css.jq.publisherContainer.append($('<div/>').attr("id", publisherId));
          var publishProperties = $.extend({
            publishAudio: !this.options.pushTalk,
          }, this.options.publishProperties);
          this.publisher = this.session.publish(publisherId, publishProperties);
          this.status.publishing = true;
          this._updateButtons();
          this._addPublisherEventListeners(this.publisher);
          this._trigger($.openTok.event.publish, {event: e, publisher: this.publisher});
        }
      }
      catch(err){
        alert(err);
      }
      

    },
    unpublish: function(e){
      this.session.unpublish(this.publisher);
      delete this.publisher;
      this.status.publishing = false;
      this._updateButtons();
      this._trigger($.openTok.event.unpublish, e);
    },
    pushTalkMode: function(e){
      this.options.pushTalk = !this.options.pushTalk;
      this.publisher.publishAudio(!this.options.pushTalk);
      this._updateButtons();
    },
    pushTalkToggle: function(e){
    },
    pushTalkToggleDown: function(e){
      for(var i = 0; i < this.streams.length; i++){
        this.streams[i].subscriber.subscribToAudio(false);
      }
      this.publisher.publishAudio(true);
      this.status.pushTalking = true;
      this.css.jq.pushTalkToggle.toggleClass('pushTalking', this.status.pushTalking);
    },
    pushTalkToggleUp: function(e){
      this.publisher.publishAudio(false);
      for(var i = 0; i < this.streams.length; i++){
        if(!this.streams[i].muted){
          this.streams[i].subscriber.subscribeToAudio(true);
        }
      }
      this.status.pushTalking = false;
      this.css.jq.pushTalkToggle.toggleClass('pushTalking', this.status.pushTalking);
    },
    close: function(e, stream){
      this.session.unsubscribe(stream.subscriber);
      this._removeStream(stream.subscriber.stream);
    },
    mute: function(e, stream){
      stream.subscriber.subscribeToAudio(false);
      this.streams[stream.subscriber.stream.streamId].muted = true;
      this._updateStreamButtons(stream.subscriber.stream);
    },
    unmute: function(e, stream){
      stream.subscriber.subscribeToAudio(true);
      this.streams[stream.subscriber.stream.streamId].muted = false;
      this._updateStreamButtons(stream.subscriber.stream);
    },
    muteToggle: function(e, stream){
      var muted = this.streams[stream.subscriber.stream.streamId].muted;
      stream.subscriber.subscribeToAudio(muted);
      this.streams[stream.subscriber.stream.streamId].muted = !muted;
      this._updateStreamButtons(stream.subscriber.stream);
    },
    forceUnpublish: function(e, stream){
      if(this.session.capabilities.forceUnpublish){
        this.session.forceUnpublish(stream.subscriber.stream);
      }
    },
    forceDisconnect: function(e, stream){
      if(this.session.capabilities.forceDisconnect){
        this.session.forceDisconnect(stream.subscriber.stream.connection);
      }
    },
    getStream: function(streamId){
      if(this.streams[streamId]){
        return this.streams[streamId];
      }
    },
    getPublisher: function(streamId){
      if(this.status.publishing){
        return this.publisher;
      }
    },
    option: function(key, value) {
      var options = key;

       // Enables use: options().  Returns a copy of options object
      if ( arguments.length === 0 ) {
        return $.extend( true, {}, this.options );
      }
    },
  };
})(jQuery);
