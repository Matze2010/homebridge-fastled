var request = require("request-promise");
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerAccessory("homebridge-fastled", "FastLED", FastLEDAccessory);
}

function FastLEDAccessory(log, config) {

    this.log = log;
    this.name = config["name"];
    this.host = config["host"];

    this.service = new Service.Lightbulb(this.name);

    this.service.getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));

    this.service.getCharacteristic(Characteristic.Brightness)
    .on('get', this.getBrightness.bind(this))
    .on('set', this.setBrightness.bind(this));
}

FastLEDAccessory.prototype.getState = function(callback) {
    this.getValue("power", callback);
}

FastLEDAccessory.prototype.getBrightness = function(callback) {
    this.getValue("brightness", callback);
}

FastLEDAccessory.prototype.setState = function(state, callback) {
    this.setValue("power", (state ? '1' : '0'), callback);
}

FastLEDAccessory.prototype.setBrightness = function(brightness, callback) {
    this.setValue("brightness", brightness.toString(), callback);
}

FastLEDAccessory.prototype.getServices = function() {
    return [this.service];
  }

FastLEDAccessory.prototype.getValue = function(name, callback) {
    let that = this;

    this.log.debug(`Getting ${name} ...`);

    request('http://' + this.host + '/fieldValue?name=' + name)
    .then(function (value) {
        let result = parseInt(value);
        callback(null, result);
    })
    .catch(function (err) {
        that.log("Error getting " + name + ": %s", err);
        callback(err);
    });
}

FastLEDAccessory.prototype.setValue = function(name, value, callback) {
    let that = this;

    if (typeof value !== "string") {
        throw Error("Value must be string");
    }

    var options = {
        method: 'POST',
        preambleCRLF: true,
        uri: 'http://' + this.host + '/' + name,
        form: {
            value: value
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': (6 + value.length)
        }
    };

    request.post(options)
    .then(function (response) {
        if (value === response) {
            callback();
        } else {
            callback(new Error(`Error setting ${name}.`));
        }
    })
    .catch(function (err) {
        that.log("Error setting " + name + ": %s", err);
        callback(err);
    });
}


  /********************************************/

  function getBool(val){ 
    var num = +val;
    return !isNaN(num) ? !!num : !!String(val).toLowerCase().replace(!!0,'');
}