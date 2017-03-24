var helpers = require('./helpers');
var events = require('events');
var rpio = helpers.getRpio(process.platform);

var initializationTimeoutInMs = 60000; // 1 minute
var blockTimeoutTimeInMs = 60000; // 1 minute

class MotionSensorEmitter extends events.EventEmitter {
    constructor(pin) {
        super();

        this.pin = pin;
        this.state = null;
        this.blockTimeoutId = null;

        rpio.open(pin, rpio.INPUT);

        // Don't start polling for a minute, this is about how long it takes
        // for the motion sensor to boot up
        this.initializationTimeoutId = setTimeout(() => {
            console.log('Motion sensor ready');
            this.emit('ready');
            this.readChange();
            rpio.poll(pin, () => this.handlePinUpdate());
        }, initializationTimeoutInMs);

        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
    }
    handlePinUpdate() {
        var currentState = this.read();
        if (this.state !== currentState) {
            if (currentState === rpio.LOW) {
                console.log('Starting block timer, but keeping signal active');
                this.blockTimeoutId = this.blockTimeoutId || setTimeout(() => {
                    console.log('Block timer over, signal output now low');
                    this.emit('state', this.state = rpio.LOW);
                }, blockTimeoutTimeInMs);
            } else {
                console.log('Signal output high');
                clearTimeout(this.blockTimeoutId);
                this.blockTimeoutId = null;
                this.emit('state', this.state = rpio.HIGH);
            }
        }
    }
    read() {
        return rpio.read(this.pin);
    }
    cleanup() {
        clearTimeout(this.initializationTimeoutId);
        clearTimeout(this.blockTimeoutId);
        rpio.close(this.pin, rpio.PIN_PRESERVE);
        this.eventNames().forEach(
            (eventName) => this.removeAllListeners(eventName));
    }
}

module.exports = function (pin) {
    return new MotionSensorEmitter(pin);
};