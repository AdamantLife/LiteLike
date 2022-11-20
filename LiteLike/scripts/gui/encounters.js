/**
 * Convenience function to clear the Event Popup (before populating)
 * and return a reference to it for use
 * 
 * @returns {Element} - a reference to the Event Popup
 */
 export function clearEvents(){
    // Get Box
    let eventBox = document.getElementById("events");
    // Clear box of all child elements
    while(eventBox.lastElementChild) eventBox.lastElementChild.remove();
    // Return so calling function doesn't have to look for it
    return eventBox;

}

/**
 * Makes sure the #events div is shown
 */
export function showEvents(eventBox){
    if(!eventBox || typeof eventBox == "undefined") eventBox = document.getElementById("events");

    // If box is hidden, remove hidden
    if(eventBox.classList.contains("hidden")) eventBox.classList.remove("hidden");

    // If box is not shown, add show
    if(!eventBox.classList.contains("shown")) eventBox.classList.add("shown");
}

/**
 * Formats the event box for MessageEncounters.
 * @param {Object} encounteroptions- The return of MessageEncounter.initEncounter
 * @param {String} encounteroptions.message - The message to display
 * @param {String} [encounteroptions.exitbutton=Continue] - The label for the exit button
 * @param {Function} callback - The function called when the exit button is pushed
 */
export function loadMessage(encounteroptions, callback){
    // Get and clear Event box
    let eventBox = clearEvents();
    let buttontext = encounteroptions.exitbutton;
    if(!buttontext || typeof buttontext == "undefined") buttontext = "Continue";

    eventBox.insertAdjacentHTML('beforeend',`<p>${encounteroptions.message}</p><button id="eventexit">${buttontext}</button>`);
    // Callback for the eventexit button provides the GAME's current encounter
    eventBox.querySelector("#eventexit").onclick = ()=>callback(GAME.ENCOUNTER.get());

    // Show event box if it isn't already
    showEvents(eventBox);
}

/**
 * Formats the event box for CallbackEncounters.
 * NOTE: CallbackEncounter is a subclass of MessageEncounter, so this simply wraps loadMessage
 * @param {Object} encounteroptions- The return of MessageEncounter.initEncounter
 * @param {String} encounteroptions.message - The message to display
 * @param {Function} encounteroptions.callback - The Callback to call after the message is displayed
 * @param {String} [encounteroptions.exitbutton=Continue] - The label for the exit button
 * @param {Function} callback - The function called when the exit button is pushed
 */
 export function loadCallback(encounteroptions, callback){
    loadMessage(encounteroptions, callback);
    encounteroptions.callback();
}