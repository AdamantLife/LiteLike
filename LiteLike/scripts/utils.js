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
        let event = new Event(eventtype.toString());
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