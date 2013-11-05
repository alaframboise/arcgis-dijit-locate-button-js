define([
    "dojo/Evented",
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/has",
    "esri/kernel",
    "dijit/_WidgetBase",
    "dijit/a11yclick",
    "dijit/_TemplatedMixin",
    "dojo/on",
    "dojo/Deferred",
    // load template
    "dojo/text!zesri/dijit/templates/LocateButton.html",
    "dojo/i18n!zesri/nls/jsapi",
    "dojo/dom-class",
    "dojo/dom-style",
    "esri/geometry/Point",
    "esri/SpatialReference",
    "esri/graphic",
    "esri/symbols/PictureMarkerSymbol",
    "esri/layers/GraphicsLayer"
],
function (
    Evented,
    declare,
    lang,
    has, esriNS,
    _WidgetBase, a11yclick, _TemplatedMixin,
    on,
    Deferred,
    dijitTemplate, i18n,
    domClass, domStyle,
    Point, SpatialReference,
    Graphic, PictureMarkerSymbol,
    GraphicsLayer
) {
    var Widget = declare([_WidgetBase, _TemplatedMixin, Evented], {
        declaredClass: "esri.dijit.LocateButton",
        templateString: dijitTemplate,
        options: {
            theme: "LocateButton",
            map: null,
            visible: true,
            highlightLocation: true,
            symbol: new PictureMarkerSymbol(require.toUrl("esri/dijit") + '/images/blue-dot.png', 21, 21),
            infoTemplate: null,
            scale: null,
            useTracking: true,
            tracking: false,
            setScale: true,
            centerAt: true,
            geolocationOptions: {
                maximumAge: 0,
                timeout: 15000,
                enableHighAccuracy: true
            }
        },
        // lifecycle: 1
        constructor: function(options, srcRefNode) {
            // mix in settings and defaults
            var defaults = lang.mixin({}, this.options, options);
            // widget node
            this.domNode = srcRefNode;
            this._i18n = i18n;
            // hide if unsupported
            if (!navigator.geolocation) {
                defaults.visible = false;
                console.log('LocateButton::navigator.geolocation unsupported.');
            }
            // properties
            this.set("map", defaults.map);
            this.set("theme", defaults.theme);
            this.set("visible", defaults.visible);
            this.set("scale", defaults.scale);
            this.set("highlightLocation", defaults.highlightLocation);
            this.set("symbol", defaults.symbol);
            this.set("infoTemplate", defaults.infoTemplate);
            this.set("geolocationOptions", defaults.geolocationOptions);
            this.set("useTracking", defaults.useTracking); // new
            this.set("tracking", defaults.tracking); // new
            this.set("setScale", defaults.setScale); // new
            this.set("centerAt", defaults.centerAt); // new
            // listeners
            this.watch("theme", this._updateThemeWatch);
            this.watch("visible", this._visible);
            this.watch("tracking", this._locate);
            this.watch("useTracking", lang.hitch(this, function(){
               if(this.get("tracking") && !this.get("useTracking")){
                   this._stopTracking();
               }
            }));
            // classes
            this._css = {
                container: "locateContainer",
                locate: "zoomLocateButton",
                loading: "loading",
                tracking: "tracking" // new
            };
        },
        // bind listener for button to action
        postCreate: function() {
            this.inherited(arguments);
            this.own(
                on(this._locateNode, a11yclick, lang.hitch(this, this.locate))
            );
        },
        // start widget. called by user
        startup: function() {
            // map not defined
            if (!this.get("map")) {
                this.destroy();
                console.log('LocateButton::map required');
            }
            // graphics layer
            this.set("graphicsLayer", new GraphicsLayer());
            this.get("map").addLayer(this.get("graphicsLayer"));
            // graphics remove highlight on clear
            this._graphicsEvent = on(this.get("graphicsLayer"), 'graphics-clear', lang.hitch(this, function(){
                this.set("highlightGraphic", null);
            }));
            // when map is loaded
            if (this.get("map").loaded) {
                this._init();
            } else {
                on(this.get("map"), "load", lang.hitch(this, function() {
                    this._init();
                }));
            }
        },
        // connections/subscriptions will be cleaned up during the destroy() lifecycle phase
        destroy: function() {
            if(this._graphicsEvent){
                this._graphicsEvent.remove();
            }
            this.inherited(arguments);
        },
        /* ---------------- */
        /* Public Events */
        /* ---------------- */
        // locate
        // load
        /* ---------------- */
        /* Public Functions */
        /* ---------------- */
        clear: function(){
            this.get("graphicsLayer").clear();
        },
        locate: function() {
            // toggle tracking
            if(this.get("useTracking")){
                this.set("tracking", !this.get("tracking"));
            }
            this._locate();
        },
        show: function(){
            this.set("visible", true);  
        },
        hide: function(){
            this.set("visible", false);
        },
        /* ---------------- */
        /* Private Functions */
        /* ---------------- */
        _removeWatchPosition: function(){
            if(this.get("watchPosition")){
                // remove watch event
                navigator.geolocation.clearWatch(this.get("watchPosition"));
                // set watch event
                this.set("watchPosition", null);
            }
        },
        _stopTracking: function(def){
            domClass.remove(this._locateNode, this._css.tracking);
            this._removeWatchPosition();
            // remove loading class
            this._hideLoading();
            def.resolve();
        },
        _startTracking: function(def){
            domClass.add(this._locateNode, this._css.tracking);
            this._removeWatchPosition();
            var watchEvent = navigator.geolocation.watchPosition(lang.hitch(this, function(position) {
                this._position(position, def);
            }), lang.hitch(this, function(error) {
                this._geolocateError(error, def);
            }), this.get('geolocationOptions'));
            // set watch event
            this.set("watchPosition", watchEvent);
        },
        _getCurrentPosition: function(){
            // get location
            navigator.geolocation.getCurrentPosition(lang.hitch(this, function(position) {
                this._position(position, def);
            }), lang.hitch(this, function(error) {
                this._geolocateError(error, def);
            }), this.get('geolocationOptions'));
        },
        _locate: function(){
            var def = new Deferred();
            // add loading class
            this._showLoading();
            // geolocation support
            if (navigator.geolocation) {
                // watch position
                if(this.get("useTracking")){
                    // watch position exists
                    if(this.get("tracking")){
                        this._startTracking(def);
                    }
                    else{
                        this._stopTracking(def);
                    }
                }
                else{
                    this._getCurrentPosition(def);
                }
            }
            else{
                this._hideLoading();
                console.log('LocateButton::geolocation unsupported');
                def.reject('LocateButton::geolocation unsupported');
            }
            return def.promise;
        },
        _position: function(position, def){
            // position returned
            if (position && position.coords) {
                // point info
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;
                // scale info
                var scale = this.get("scale") || position.coords.accuracy || 50000;
                // set point
                var pt = new Point([longitude, latitude], new SpatialReference({ wkid:4326 }));
                if(pt){
                    // highlight enabled
                    // if setScale is enabled
                    if(this.get("setScale")){
                        // set scale
                        this.get("map").setScale(scale);
                    }
                    if(this.get("centerAt")){
                        // center on point
                        this.get("map").centerAt(pt).then(lang.hitch(this, function(){
                            this._finishEvent(pt, scale, position, def);
                        }), lang.hitch(this, function(error){
                            def.reject(error.message);
                        }));
                    }
                    else{
                        this._finishEvent(pt, scale, position, def);
                    }
                }
                else{
                    // remove loading class
                    this._hideLoading();
                    def.reject('LocateButton::Invalid point');
                    console.log('LocateButton::Invalid point');
                }
            }
            else{
                // remove loading class
                this._hideLoading();
                console.log('LocateButton::Invalid position');
                def.reject('LocateButton::Invalid position');
            }
        },
        _finishEvent: function(pt, scale, position, def){
            // graphic attributes
            var attributes = {
                position: position
            };
            if(this.get("highlightGraphic")){
                this.get("highlightGraphic").setGeometry(pt);
                this.get("highlightGraphic").setAttributes(attributes);
                this.get("highlightGraphic").setInfoTemplate(this.get("infoTemplate"));
                this.get("highlightGraphic").setSymbol(this.get("symbol"));                
            }
            else{
                // create graphic
                var g = new Graphic(pt, this.get("symbol"), attributes, this.get("infoTemplate"));
                // highlight enabled
                if(this.get("highlightLocation")){
                    this.get("graphicsLayer").add(g);
                }
                this.set("highlightGraphic", g);
            }
            // hide loading class
            this._hideLoading();
            // set event
            var locateEvt = {graphic: g, scale: scale, position: position};
            this.emit("locate", locateEvt);
            def.resolve(locateEvt);
        },
        _geolocateError: function(error, def){
            // remove loading class
            this._hideLoading();
            var errorMessage = 'LocateButton::' + error.code + ":" + error.message;
            console.log(errorMessage);
            def.reject(errorMessage);
        },
        _showLoading: function(){
            if(!this.get("useTracking")){
                domClass.add(this._locateNode, this._css.loading);
            }
        },
        _hideLoading: function(){
            if(!this.get("useTracking")){
                domClass.remove(this._locateNode, this._css.loading);
            }
        },
        _init: function() {
            this._visible();
            if(this.get("useTracking") && this.get("tracking")){
                this._locate();
            }
            this.set("loaded", true);
            this.emit("load", {});
        },
        _updateThemeWatch: function(attr, oldVal, newVal) {
            domClass.remove(this.domNode, oldVal);
            domClass.add(this.domNode, newVal);
        },
        _visible: function(){
            if(this.get("visible")){
                domStyle.set(this.domNode, 'display', 'block');
            }
            else{
                domStyle.set(this.domNode, 'display', 'none');
            }
        }
    });
    if (has("extend-esri")) {
        lang.setObject("dijit.LocateButton", Widget, esriNS);
    }
    return Widget;
});
