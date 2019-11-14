var request = require("request-promise");
var Color = require('color');
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

    this.hue = 255;
    this.saturation = 100;
    this.brightness = 50;

    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, 'NodeMCU')
        .setCharacteristic(Characteristic.Model, 'ESP8266+FastLED')
        .setCharacteristic(Characteristic.SerialNumber, '123456789');


    this.service = new Service.Lightbulb(this.name);

    this.service.getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));

    this.service.getCharacteristic(Characteristic.Brightness)
    .on('get', this.getBrightness.bind(this))
    .on('set', this.setBrightness.bind(this));

    this.service.getCharacteristic(Characteristic.Hue)
    .on('get', this.getHue.bind(this))
    .on('set', this.setHue.bind(this));

    this.service.getCharacteristic(Characteristic.Saturation)
    .on('get', this.getSaturation.bind(this))
    .on('set', this.setSaturation.bind(this));
}

FastLEDAccessory.prototype.getState = function(callback) {
    this.getValue("power", callback);
}

FastLEDAccessory.prototype.getBrightness = function(callback) {
    this.getValue("brightness", callback);
}

FastLEDAccessory.prototype.getHue = function(callback) {
    this.getHSV('h', callback);
}

FastLEDAccessory.prototype.getSaturation = function(callback) {
    this.getHSV('s', callback);
}

FastLEDAccessory.prototype.setState = function(state, callback) {
    this.setValue("power", (state ? '1' : '0'), callback);
}

FastLEDAccessory.prototype.setBrightness = function(brightness, callback) {
    this.setValue("brightness", brightness.toString(), callback);
}

FastLEDAccessory.prototype.setSaturation = function(saturation, callback) {
    this.saturation = saturation;
    this.log(`Set Saturation: ${saturation}`);

    var color = Color(`hsl(${this.hue}, ${this.saturation}%, ${this.brightness}%)`);
    var rgb = color.rgb().object();
    this.setColor(rgb, callback);
}

FastLEDAccessory.prototype.setHue = function(hue, callback) {
    this.hue = hue;
    this.log(`Set Hue: ${hue}`);

    var color = Color({
		h: this.hue,
		s: this.saturation,
		l: this.brightness
	});
    var rgb = color.rgb().object();

    this.setColor(rgb, callback);
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

FastLEDAccessory.prototype.getHSV = function(component, homebridgecallback) {
    var that = this;

    this.log.debug(`Getting HSV component ${component} ...`);

    this.getRGB(function(err, rgb) {
        if (err) {
            homebridgecallback(err);
        }

        let color = Color({r: rgb.red, g: rgb.green, b: rgb.blue}); 
        let hsl = color.hsl().object();
        that.hue = hsl.h;
        that.saturation = hsl.s;
        that.brightness = hsl.l;
        homebridgecallback(null, hsl[component]);
    });

}

FastLEDAccessory.prototype.getRGB = function(callback) {
    let that = this;

    return request('http://' + this.host + '/all')
    .then(function (value) {
        let json = JSON.parse(value);
        let wert = json.filter(entry => entry.type === 'Color');
        let rgbString = wert[0].value;
        let liste = rgbString.split(',');
        let rgb = { 
            red: liste[0],
            green: liste[1],
            blue: liste[2]
        };
        callback(null, rgb);
    })
    .catch(function (err) {
        that.log("Error getting RGB: %s", err);
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

FastLEDAccessory.prototype.setColor = function(rgb, callback) {
    let that = this;
    let queryString = `r=${rgb.r}&g=${rgb.g}&b=${rgb.b}`

    var options = {
        method: 'POST',
        preambleCRLF: true,
        uri: 'http://' + this.host + '/solidColor',
        form: {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': queryString.length
        }
    };

    request.post(options)
    .then(function (response) {
        callback();
    })
    .catch(function (err) {
        that.log("Error setting Color: %s", err);
        callback(err);
    });
}


  /********************************************/

  function getBool(val){ 
    var num = +val;
    return !isNaN(num) ? !!num : !!String(val).toLowerCase().replace(!!0,'');
}

function rgbToHsl(r, g, b) {
    var r1 = r / 255;
    var g1 = g / 255;
    var b1 = b / 255;
 
    var maxColor = Math.max(r1,g1,b1);
    var minColor = Math.min(r1,g1,b1);
    //Calculate L:
    var L = (maxColor + minColor) / 2 ;
    var S = 0;
    var H = 0;
    if(maxColor != minColor){
        //Calculate S:
        if(L < 0.5){
            S = (maxColor - minColor) / (maxColor + minColor);
        }else{
            S = (maxColor - minColor) / (2.0 - maxColor - minColor);
        }
        //Calculate H:
        if(r1 == maxColor){
            H = (g1-b1) / (maxColor - minColor);
        }else if(g1 == maxColor){
            H = 2.0 + (b1 - r1) / (maxColor - minColor);
        }else{
            H = 4.0 + (r1 - g1) / (maxColor - minColor);
        }
    }
 
    L = L * 100;
    S = S * 100;
    H = H * 60;
    if(H<0){
        H += 360;
    }
  
    return { h: H, s: S, l: L };
  }

  function hslToRgb(h, s, l) {

    h /= 60;
    s /= 100;
    l /= 100;

    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { red: Math.round(r * 255), green: Math.round(g * 255), blue: Math.round(b * 255)};
}