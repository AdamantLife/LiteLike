"use-strict";

/**
 * Changes the text color of an element so it flashes between the given
 * color and its default color
 * 
 * @param {Element} element - The element to have its text color change
 * @param {Object} [options=null] - Additional options to stylize the effect
 * 
 * @param {String} [options.color="f00"] - The color to change it to
 * @param {String} [options.backgroundColor=null] - The background color to change it to
 * @param {Number} [options.duration=500] - How long each flash lasts in millis
 * @param {Number} [options.iterations=3]- Number of times to flashes
 */
export function flashText(element, options ={}){
    let color = "#f00", duration = 500, iterations = 3, backgroundColor = null;
    if(options.color && typeof options.color !== "undefined") color = options.color;
    if(options.duration && typeof options.duration !== "undefined") duration = options.duration;
    if(options.iterations && typeof options.iterations !== "undefined") iterations = options.iterations;
    if(options.backgroundColor && typeof options.backgroundColor !== "undefined") backgroundColor = options.backgroundColor;

    let animation = {color, easing: "ease-in"};
    let revert = {color:"revert-layer", easing:"ease-out"};
    
    // Update animation values if backgroundColor is provided
    if(backgroundColor){
        animation.backgroundColor = backgroundColor;
        revert.backgroundColor = "revert-layer";
    }
    element.animate([animation,revert], {duration, iterations});
}

/**
 * Animates the text of an element getting larger and then returning to normal size
 * @param {Element} element - Element to have its text change size
 * @param {Object} options - Additional options to stylize the effect
 * 
 * @param {Number} options.proportion - How much to changethe size by, as a decimal number (>1 to make the text grow)
 * @param {Number} options.duration - How long each iteration lasts
 * @param {Number} options.iterations - How many times to make the text change size
 */
export function swellText(element, options){
    let proportion = 1.25, duration = 500, iterations = 1;
    if(options.proportion && typeof options.proportion !== "undefined") proportion = options.proportion;
    if(options.duration && typeof options.duration !== "undefined") duration = options.duration;
    if(options.iterations && typeof options.iterations !== "undefined") iterations = options.iterations;

    // Get adjusted size
    // Need to Compute current size and then parse from result
    let size = parseFloat(window.getComputedStyle(element, null).getPropertyValue("font-size"));
    //Adjust Size by proportion
    size = size * proportion

    element.animate([{fontSize: size+"px", easing: "ease-in"},{fontSize:"revert-layer", easing:"ease-out"}], {duration, iterations});
}

/**
 * Generates and attaches the Resize callback
 * @param {Element} panel - The button element to which this is attached to
 */
export function attachPanelResizeCallback(panel){
    let header = panel.querySelector(".header");
    let resize = panel.querySelector("button.resize");
    let body = panel.querySelector(".body")
    function callback(){
        // Toggle the display style (body shown/hidden, resize content based on new state)
        if(resize.classList.contains("hidden")){
            resize.classList.remove("hidden");
            body.classList.remove("hidden");
        }else{
            resize.classList.add("hidden");
            body.classList.add("hidden");
        }
    }
    header.onclick = callback;
}

/**
 * Parses a Color Hexstring into an object {r:Integer, g:Integer, b:Integer}
 * @param {*} color - The Hexstring to parse
 * @returns {Object} - An object with r, g, and b values as Integers corresponding to the parsed hexstring
 */
function parseHexString(color){
    // This regex acccepts the Hexstring either starting with the # sign or without it
    // It has two possible captures: 3 single Hexidecimal characters ending at the end of the string
    //                               or 3 pairs of Hexidecimal cahracters ending at the end of the string
    let result = /^#?(?:([0-9a-f])([0-9a-f])([0-9a-f])$|([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$)/i.exec(color);

    // Invalid Color Code, return null
    if(!result) return;

    // If a single character (result[1]) was not captured, use result[4], otherwise use result[1]
    // Then parseInt the string with base 16
    let r = parseInt(typeof result[1] == "undefined" ? result[4] : result[1], 16);
    // Repeat for g and b
    let g = parseInt(typeof result[2] == "undefined" ? result[5] : result[2], 16);
    let b = parseInt(typeof result[3] == "undefined" ? result[6] : result[3], 16);
    // Make sure all values are Integers
    // If any are not numbers, return null
    if(isNaN(r) || isNaN(g) || isNaN(b)) return;
    // Finally, return the RGB object
    return {r, g, b};
}

/**
 * Converts an object containing r, g, and b integer values into a Color Hexstring
 * @param {Object} color - An object with r, g, and b values as integers
 */
function createHexString(color){
    function padConvert(int){
        // Convert to Hex value (string)
        let result = Number(int).toString(16);
        // Pad single digit values with leading 0
        if(result.length == 1) result = "0"+result;
        return result;
    }
    return "#"+padConvert(color.r)+padConvert(color.g)+padConvert(color.b);
}

/**
 * Given a start and stop color, a duration for a transformation function
 * to convert from start to stop, and assuming the transformation is linear
 * estimate what color is displayed at a specific time
 * @param {String} colorA - Hexcode for the Start Color
 * @param {String} colorB - Hexcode for the Stop Color
 * @param {Number} duration - How long it takes for the transformation to take place; note that this should be in the same units as attime
 * @param {Number} attime - The desired point in the transformation to estimate the color
 * @returns {String} - The Hexcode for the estimated color at attime
 */
export function calcColorTransition(colorA, colorB, duration, attime){
    // If attime is negative or zero, then we already know it's colorA
    if(attime <= 0) return colorA;
    // If attime is greater or equal to duration, then we already know it's colorB
    if(attime >= duration) return colorB;
    // Convert colors to rgb values
    colorA = parseHexString(colorA);
    colorB = parseHexString(colorB);

    // If we can't parse A or B, just return that unparseable value back
    // DEVNOTE- As in other places, we should technically raise an error,
    //          but that's something we decided not to do in the code
    if(!colorA) return colorA;
    if(!colorB) return colorB;

    // Calculate value-change per unit duration for each rgb
    // DEVNOTE- This is only valid for linear transformations: the code would
    //          have to be adjusted to account for non-linear transforms
    let delta = {
        r: (colorB.r - colorA.r) / duration,
        g: (colorB.g - colorA.g) / duration,
        b: (colorB.b - colorA.b) / duration
    }

    // Calculate the new value by offsetting
    // colorA by (change/unittime * attime)
    // Round it in order to generate a valid color value
    let result = {
        r: Math.floor(colorA.r + (delta.r * attime)),
        g: Math.floor(colorA.g + (delta.g * attime)),
        b: Math.floor(colorA.b + (delta.b * attime))
    }

    // Convert back to hexstring
    return createHexString(result);
}

/**
 * Callback which removes the manually-set properties of a progressbar.
 * Should be the callback for eventListener(animation) (which this function also removes)
 * @param {Event} event- animation event
 */
 export function clearPartialProgress(event){
    event.target.style.width = "revert-layer";
    event.target.style.backgroundColor = "revert-layer";
    event.target.style.transitionDuration = "";
}

/**
 * Resorts all rows in a table body
 * @param {Element} tablebody - The tbody to resort
 * @param {Function} [compareFN=idSort] - An optional comparison function to use for the sort.
 *      The default idSort is a function which compares dataset.id as integers
 */
export function sortTableBody(tablebody, compareFN=null){
    // The default compareFN sorts each row by its data-id value, parsing the value as an Integer
    if(!compareFN) compareFN = (a,b)=>parseInt(a.dataset.id) - parseInt(b.dataset.id);

    // Get rows
    let rows = [... tablebody.children];
    // Sort the,
    rows.sort(compareFN);
    // Remove each row and reappend it in order to reorder the tbody
    for(let row of rows){
        row.remove();
        tablebody.append(row);
    }
}