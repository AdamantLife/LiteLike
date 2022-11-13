"use-strict";

/**
 * Changes the text color of an element so it flashes between the given
 * color and its default color
 * 
 * @param {Element} element - The element to have its text color change
 * @param {Object} options - Additional options to stylize the effect
 * 
 * @param {String} options.color - The color to change it to; defaults to red
 * @param {Number} options.duration - How long each flash lasts in millis
 * @param {Number} options.iterations- Number of times to flashes
 */
export function flashText(element, options){
    let color = "#f00", duration = 500, iterations = 3;
    if(options.color && typeof options.color !== undefined) color = options.color;
    if(options.duration && typeof options.duration !== undefined) duration = options.duration;
    if(options.iterations && typeof options.iterations !== undefined) iterations = options.iterations;

    element.animate([{color, easing: "ease-in"},{color:"revert-layer", easing:"ease-out"}], {duration, iterations});
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
    if(options.proportion && typeof options.proportion !== undefined) proportion = options.proportion;
    if(options.duration && typeof options.duration !== undefined) duration = options.duration;
    if(options.iterations && typeof options.iterations !== undefined) iterations = options.iterations;

    // Get adjusted size
    // Need to Compute current size and then parse from result
    let size = parseFloat(window.getComputedStyle(element, null).getPropertyValue("font-size"));
    //Adjust Size by proportion
    size = size * proportion

    element.animate([{fontSize: size+"px", easing: "ease-in"},{fontSize:"revert-layer", easing:"ease-out"}], {duration, iterations});
}
