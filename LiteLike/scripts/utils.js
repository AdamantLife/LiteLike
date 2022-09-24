// How often loops in the game update
const LOOPRATE = 1000 / 16; // 1 second in ms, at 16fps

/**
 * Converts the provided arguments into a frozen object
 * @returns {Object} - A frozen object of the given arguments 
 * 
 * Adapted from: https://stackoverflow.com/q/44447847
 */
export function enumerate(){
    // Create an object to return
    let _s = {};
    // Add all arguments to the object, using them as the key
    // and their Symbol as the value
    for(let a of arguments) _s[a] = Symbol(a);
    // Return a frozen version of the object
    return Object.freeze(_s);
}

/**
 * Returns a random element from the provided Array. A rng can be
 * provided to use; otherwise, Math.random can be used.
 * 
 * @param {Array} array - The array to choose an element from
 * @param {*} random - A random number generator to use
 * @returns {* | null} - A random element from the array, or null if the array is empty
 */
export function randomChoice(array, random){
    // No elements in array, so return None
    if(!array.length) return null;
    // If a random number generator is not provided, use Math.random
    if(typeof random == "undefined") random = Math.random;
    
    // random() == float between 0 inclusive and 1 exclusive
    // That number maps onto array.length
    // Round down so that our result is between 0 inclusive and 1 exclusive
    // Return that array index
    return array[Math.floor(random() * array.length)];

    /**
     * Examples:
     * array = ["a", "b", "c"];
     * array.length = 3
     * 
     * random() = .95431887
     * .95431887 * 3 = 2.86295661
     * Math.floor(2.86295661) = 2
     * return array[2] ("c")
     * 
     * random = .00005135
     * .00005135 * 3 = .00015405
     * Math.floor(.00015405) = 0
     * return array[0] ("a")
     */
}




/**
 * @returns The time in milliseconds since the browser tab was last loaded
 * 
 * Taken from https://stackoverflow.com/a/16081647
 */
export function now(){
    /** DEVNOTE - This timing mechanism is not appropriate for long-term storage as it is based on page load time
     *              It therefore should not be used resource collection
    */
   return performance.now();
}

/**
 * 
 * @param {Prototype} cls - The class to create a new instance of
 * @param {Object} jsn - The json to be assigned to the class
 */
export function instanceFromJSON(cls, jsn){
    let obj = new cls();
    return Object.assign(obj, jsn);
}


export class EventListener{

    constructor(events){
        // Super Simple EventListener setup
        this._events = events;
        this._listeners = {};
        for(let sym of Object.values(this._events)){
            this._listeners[sym] = [];
        }
    }

    /**
     * Internal method to validate the Eventtype passed to Add and Remove Listeners
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration)
     * @returns {Symbol} - The enumerated symbol from EVENTTYPES
     */
    _validateEventType(eventtype){
        // If eventtype is a string, convert it to the Enumerated value
        if(typeof eventtype == "string"){ 
            // note that this may result in undefined if this is not a
            // valid eventtype string, which will fail the next check
            eventtype = this._events[eventtype];
        }
        
        // Check that eventtype is a Symbol in EVENTTYPES
        // As with other places in the code, this should raise an Error,
        // but we're trying to keep this simple so we'll just fail silently
        if(Object.values(this._events).indexOf(eventtype) < 0) return;

        return eventtype;
    }

    /**
     * Adds an eventlistener to the Combat
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration)
     * @param {Function} callback - The callback to call
     */
    addEventListener(eventtype, callback){
        // Make sure eventtype is valid
        eventtype = this._validateEventType(eventtype);
        // If eventtype was invalid, it will now be null and we will fail silently
        if(!eventtype) return;
        
        // Event has already been registered, so do nothing
        if(this._listeners[eventtype].indexOf(callback) > -1) return;

        // Register the callback under its type
        this._listeners[eventtype].push(callback);
    }

    /**
     * Removes an eventlistener from the Combat
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration)
     * @param {*} callback - The callback to remove
     */
    removeEventListener(eventtype, callback){
        // Make sure eventtype is valid
        eventtype = this._validateEventType(eventtype);
        // If eventtype was invalid, it will now be null and we will fail silently
        if(!eventtype) return;

        let listeners = this._listeners[eventtype];
        // Get the index of the callback to remove it from the array
        let eventindex = listeners.indexOf(callback);

        // If the callback isn't in the array, we'll fail silently
        if(eventindex < 0) return;

        // Remove callback from listeners
        listeners.splice(eventindex, 1);
    }

    /**
     * Call all Callbacks for the given eventtype
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration) 
     * @param {Object} additional - Additional properties to add to the Event Object
     */
    triggerEvent(eventtype, additional){
        eventtype = this._validateEventType(eventtype);
        let event = new Event(eventtype.description);
        Object.assign(event, this.getDefaultEventData());
        // If additional properties were passed, add them
        if(additional && typeof additional !== "undefined"){
            Object.assign(event,additional);
        }
        for(let listener of this._listeners[eventtype]){
            let result = listener(event);
            // TODO: consider cancelling combat via listener
        }
    }

    /**
     * This function provides information univeral to all callbacks from 
     * this object. This function should be overwritten in subclasses.
     * @returns {Object} - The default data; an empty object if not implemented
     */
    getDefaultEventData(){
        return {};
    }
}

export class Timer {
    /**
     * 
     * @param {Number} startTime - performance.now
     * @param {Number} rate - The time that elapses between cycles
     */
    constructor(startTime, rate){
        this.startTime = startTime;
        this.rate = rate;

        this._frozen = null;

        this.cycles = 0;
        this._collectFlag = false;
    }
    

    /**
     * @returns {Boolean} - Whether or not the Timer can be collected from
     */
    get isReady(){
        return Boolean(this._collectFlag);
    }

    /**
     * @returns {Boolean} - Whether or not the Timer is frozen
     */
    get isFrozen(){
        return Boolean(this._frozen);
    }

    /**
     * Resets the Timer's current state (unfreezes, clears ready, clears cycles)
     * If now is provided, startTime will be set to it; otherwise, now will be called
     * @param {Number} _now - performance.now
     */
    reset(_now){
        if(typeof _now === "undefined") _now = now();
        // Calling freeze to make sure nothing happens
        this.freeze();
        // Clear Cycles
        this.cycles = 0;
        // Clear Ready
        this.clearReady();
        // Update startTime
        this.startTime = _now;
        // Unfreeze; since preserve was undefined, no offset will be used
        this.unfreeze();
    }

    /**
     * A function just because we should touch internal variables
     * (and, potentially, the timer may want to do other things when
     * it is no longer ready)
     */
    clearReady(){
        this._collectFlag = false;
    }

    /**
     * Freezes the Timer at the current time offset.
     * Frozen Timers must call unfreeze in order to properly resume functionality
     * @param {Number} now - the runtime ms when the Timer is Frozen
     * @param {Boolean} preserve - Whether or not to preserve the offsetTime; false is
     *                              the default in which case offsetTime is not stored
     */
    freeze(now, preserve){
        // Have to use -1 for _frozen because we simply call Boolean for isFrozen()
        if(!preserve || typeof preserve == "undefined") {this._frozen = -1;}
        else {this._frozen = this.getOffsetTime(now);}
    }

    /**
     * Unfreezes the Timer so it can continue operation
     * @param {Number} _now - the runtime ms when the Timer is UnFrozen
     */
    unfreeze(_now){
        if(typeof _now === "undefined") _now = now();
        // To unfreeze a timer, we need to start it counting from now()
        // so we use setOffsetTime to set an oppropriate startTime
        // If _frozen is -1 that indicates that we should offset by 0;
        this.setOffsetTime(_now, this._frozen == -1 ? 0 : this._frozen);

        // Set _frozen to null so it no longer isFrozen
        this._frozen = null;
    }

    /**
     * Updates how many cycles the Meeple has completed for its current job
     * If the number is incremented, then collectFlag is set to true
     * @param {Number} now - performance.now
     */
     updateCycles(now){
        // Frozen Timers do not update their cycles
        if(this.isFrozen) return;
        
        // How many Cycles the Timer has completed
        let cycles = Math.floor((now - this.startTime) / this.rate);
        // The Meeple has completed one or more Job Cycles since the last time
        // it was updated
        if(cycles > this.cycles){
            // Set Meeple to be collected from
            /**
             * DEVNOTE- There is no reason at the moment for this._collectFlag
             *      to ever be more than 1 (updateLoops should be running faster
             *      than Timers), but just incase that changes, we'll set it to
             *      the difference instead of just true.
             */
            this._collectFlag = cycles - this.cycles;

            // Update cycles
            this.cycles = cycles;
        }
    }

        /**
     * DEVNOTE - Saving Timers
     * 
     * To save Meeple's Job State, we're just saving how long they've
     * been doing the current cycle of their current job.
     * 
     * Resources should be collected from Meeple before saving.
     * 
     * When we load, we offset the Meeple's jobStart value by that value.
     * 
     * We do not save cycles because we only track them in order to
     * avoid constantly resetting jobStart.
     * 
     * We are using the same exact sytem for Hunger
     * 
     * Example:
     *      Alice the Meeple has been Charging Batteries since 1000ms
     *      Charging Batteries takes 800ms
     *      It is now(): 3512ms
     *      We want to save the gamestate, so we call getOffsetTime on all Meeple
     *      Alice has been Charging Batteries for (3512 - 1000) = 2512ms
     *      Alice has charged (2512 / 800) = 3.14 Batteries
     *      We don't want to lose that .14 of a Battery, so we use (2512 % 800)
     *          to get the number of ms that have been done on that battery (112ms)
     *      When we load the game back up, Alice is recreated at 500ms.
     *      In order to get those 112ms back, we set her jobStart to
     *          (500 - 112) = 388ms; now, she will finish her first Battery in this
     *          game at 1188ms instead of (500+800) = 1300ms.
     */

    /**
     * Returns the modulo'd difference between now and the given startTime.
     * See above note for more information
     * If the Timer isFrozen, returns this._frozen instead (as the getOffsetTime
     *  is already calculated)
     * @param {Number} now - performance.now time: unlike other functions, this
     *                      is not optional because getOffsetTime should be called
     *                      using the same now() for all Meeple
     * @returns {Number} - The modulo'd difference in time
     */
     getOffsetTime(now){
        if(this.isFrozen) return this._frozen;
        return (now - this.startTime)   // (now - jS) is how long the timer has been performed for
                % this.rate;            // the modulus gets how much time the current
                                        // cycle has been running
        
    }

    /**
     * Sets the startTime to offset-ms before now.
     * In an attempt to preempt exploits, offset is modulo'd by rate
     * @param {Number} now - performance.now time when all timers are created
     * @param {Number} offset - Amount to offset the startTime by
     */
    setOffsetTime(now, offset){
        // This timer started offset-ms before now()
        // We're modulo'ing offset so that a timer can never be loaded with a completed cycle
        // We also offset by number of cycles
        this.startTime = now - (offset % this.rate) - (this.cycles * this.rate);
    }
}