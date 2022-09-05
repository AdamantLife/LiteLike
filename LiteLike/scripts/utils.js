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
    return Object.assign(Object.create(cls.prototype), jsn);
}