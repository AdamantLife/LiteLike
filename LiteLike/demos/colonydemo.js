"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as IO from "../scripts/io.js";
import * as UTILS from "../scripts/utils.js";
import {HUNGERRATE} from "../scripts/colony.js";

export function colonyDemo(){
    // Disable all buttons to avoid shenanigans
    toggleAllButtons(true);
    clearDemoBox();

    // Create a new TheColony
    GAME.COLONY = GAME.initializeColony();

    // Getting a reference to the DemoBox
    let demoBox = document.getElementById("demoBox");

    // Add a Table to display the Resources we've collected
    demoBox.insertAdjacentHTML("beforeend", `<h3>Resources</h3><table id="resources"><tbody></tbody></table>`);

    // Get a reference to the Table Body to add items to it
    let resourceBody = document.querySelector("#resources>tbody");

    // It will be useful elsewhere to display Resource Names
    let resourcestrings = [];

    // Prepopulate the Table with all possible resoruces in the Game
    for(let [id, resource] of Object.entries(GAME.ITEMS.resources)){

        // Getting Strings to display on the GUI
        let restring = IO.getStrings(GAME.STRINGS, resource);

        // Add to resourcestrings for reference later
        resourcestrings[id] = restring;

        // Create a row for the resource which displays its name and quantity (with Flavor Text on hover)
        resourceBody.insertAdjacentHTML("beforeend", `<tr data-id="${id}"><td title="${restring.flavor}">${restring.name}</td><td data-quantity>0</td></tr>`);
    }

    /** MEEPLE SETUP */

    // Create the Meeple Box
    demoBox.insertAdjacentHTML("beforeend", `<div id="meepleBox"></div>`);

    // Get a reference to the meepleBox for ease of use
    let meepleBox = document.getElementById("meepleBox");

    // It's easier for Job management to have a list of jobs available
    // and their associated strings
    let jobs = {};
    for (let job of GAME.JOBS){
        jobs[job.id] = {job, strings:IO.getStrings(GAME.STRINGS, job)};
    }

    // Create a Table for Displaying Meeple
    meepleBox.insertAdjacentHTML("beforeend", `<h3>Meeples</h3><table id="meeple"><thead><tr><th></th><th>Job</th><th>Hunger</th><th>Job</th></tr></thead><tbody></tbody>`);

    // Getting a reference to the Table's Body so we can add Meeple to it
    let meepleBody = document.querySelector("#meeple>tbody");

    // We're going to  initial all the Meeple's timers to the same time using now
    let now = UTILS.now();
    // For the sake of debugging, we're going to give all Meeple an ID
    var meepleindex = 0;

    /**
     * Creates a new Meeple and adds it to the UI
     * @param {Number} now - performance.now; what time to use to initialize the Meeple's Timers
     */
    function addMeeple(now){
        // If now is not provided, get the current time
        if(!now || typeof now === "undefined") now = UTILS.now();
        // Use the builtin function to create and get a reference to a new meeple
        let meeple = GAME.COLONY.addNewMeeple(now);
        // Meeple normally don't have ID's, so we're supplying them with one
        meeple.id = meepleindex;
        // Increment index for next meeple
        meepleindex+=1;
        
        // Add Row to meepleBody for this meeple
        meepleBody.insertAdjacentHTML("beforeend", `<tr data-id="meeple${meeple.id}"><td style="font-weight:bold;">${meeple.id}</td><td><span data-timer="job">0</span>/${meeple.job.collectionTime}</td><td><span data-timer="hunger">0</span>/${HUNGERRATE}</td><td><select data-job></select></td></tr>`);
        
        // Get and full in the Job Select form
        let select = meepleBody.lastElementChild.querySelector("select[data-job]");
        for(let job of Object.values(jobs)){
            // Each job gets its own option
            select.insertAdjacentHTML(`beforeend`, `<option value="${job.job.id}" title="${job.strings.flavor}">${job.strings.name}</option>`);
        }
        // The Meeple's default job is Job-index 0, so we select the very first option
        select.querySelector("option").selected = true;

        // Attaching an eventListener to update the Meeple's Job to match the UI
        select.addEventListener("change",
        (event)=>{
            meeple.assignJob( // When the Job index changes, we change the Meeple's Job
            jobs[event.target.selectedIndex].job // Since we are keeping all the jobs in ID order
                                          // we can just use selectIndex to get the job
            // we will let assignJob take care of calling now() (we won't supply it)
            );
        });
    }

    // Prepopulate the Demo with 5 meeple
    for(let i = 0; i < 5; i++){
        addMeeple(now);
    }

    /** SECTOR SETUP  */
    // Setup Sector Box
    demoBox.insertAdjacentHTML("beforeend", `<div id="sectorBox"><h3>Sectors</h3><table id="sectorTable"><thead><tr><th></th><th>Level</th><th>Progress</th></tr></thead><tbody></tbody></table></div>`);

    // Give The Colony all unlocks
    for(let unlock of COLONY.unlocks){
        GAME.COLONY.unlock(unlock);
    }

    // Give The Colony all sectors (They should be level 0)
    for(let sectortype of GAME.SECTORS){
        GAME.COLONY.addSector(sectortype)
    }

    // Add GUI

    /**
     * Useful function for turning level up costs to readable string
     * @param {Array[]} requirements - An array of length-2 arrays containing resourceid and quantity
     * @returns {String} - The readable Resource Costs to level
     */
    function constructSectorLevelCost(requirements){
        // The output string starts with "Requires:" and then newline-concats each requirement
        let costString = "Requires:";
        for(let [resource, qty] of requirements){
            costString += `
  ${resourcestrings[resource]}: ${qty}`;
        }
        return costString
    }
    
    // Get reference to table body
    let sectorBody = document.querySelector("#sectorTable>tbody");
    
    for(let sector of GAME.COLONY.sectors){
        let strings = IO.getStrings(GAME.STRINGS, sector);

        // Hovering on the Level Up Button will show the current cost
        let costString = constructSectorLevelCost(sector.calculateResourceRequirements());
        
        // Create HTML
        sectorBody.insertAdjacentHTML("beforeend", `<tr><td data-type="${sector.sectorType.toString()}"><button title="${costString}">Power ${strings.name}</button></td><td>${sector.level}</td><td><div data-timer><span data-timer>0</span>/${sector.collectionTime}</div><div data-collection style="display:none;"><button>Collect</button></div></td></tr>`);

        // Attach callbacks to buttons
        //TODO
    }


    /** ADDITIONAL SETUP */

    /**
     * At the end of each colonyLoop, update the GUI to match TheColony instance
     * @param {Event} event - The event passed by Colony.eventlistener(endupdate)
     */
    function updateGUI(event){

        // Update Resources possessed by TheColony
        let resources = GAME.COLONY.resources;

        // Iterate through each index (which is also each Resource's ID)
        for(let i = 0; i < resources.length; i++){
            // get the quantity
            let qty = resources[i];
            // There is no qty value for the resource
            // NOTE- this shouldn't actually happen in this demo because we prepopulate
            //      with all possible resources
            if(qty === null || typeof qty === "undefined")continue;
            // Get the Table Row with the Resource's ID
            let row = resourceBody.querySelector(`tr[data-id= "${i}"]`);
            // Get the Cell with with the data-quantity attribute and set
            // it to show the current quantity
            row.querySelector("td[data-quantity]").textContent = qty;
        }

        let meeples = GAME.COLONY.meeples;

        // Remove Dead meeple
        // Start by getting a list of living meeple
        let livingmeeples = [];
        for(let meeple of meeples) livingmeeples.push(meeple.id);

        // Check each meeple onscreen
        for(let row of meepleBody.querySelectorAll(`tr[data-id^="meeple"]`)){
            // Extract ID from data-id string
            let id = parseInt(/meeple(\d+)/.exec(row.dataset.id)[1]);
            // Meeple is dead if his id is not in the list
            if(livingmeeples.indexOf(id) < 0) row.remove();
        }
        
        // Update Meeple's Timers
        for(let meeple of meeples){
            // Get Meeple's Row
            let row = meepleBody.querySelector(`tr[data-id="meeple${meeple.id}"]`);
            // Get the Job Timer Cell for that row and update it
            row.querySelector(`span[data-timer="job"]`).textContent = meeple.jobTimer.getOffsetTime(event.now).toFixed(3);
            // Get the Hunger Timer Cell for that row and update it
            row.querySelector(`span[data-timer="hunger"]`).textContent = meeple.hungerTimer.getOffsetTime(event.now).toFixed(3);
        }
        
        
    }

    /**
     * Quits the demo, ending the loop and disabling all Demo Controls
     * before re-enabling the Main Screen Demo Buttons
     */
    function finishDemo(){
        // Stop the colonyLoop
        window.clearTimeout(GAME.COLONY.loopid);
        // Disable Buttons
        document.getElementById("addmeeple").disabled = true;
        document.getElementById("quitmeeple").disabled = true;;
        // Disable all Job Selects
        for(let select of meepleBody.querySelectorAll("tr>td>select")){
            select.disabled = true;
        }
        // Re-Enable The Run-Demo buttons
        toggleAllButtons(false);
    }

    // Button to add More Meeple
    meepleBox.insertAdjacentHTML("beforeend", `<button id="addmeeple">Add Meeple</button>`);
    // Button to End the Demo
    meepleBox.insertAdjacentHTML("beforeend", `<button id="quitmeeple">Quit Demo</button>`);

    // Addmeeple expects a now() component, so we have to wrap it to get rid of the event
    document.getElementById("addmeeple").onclick = (e)=>addMeeple();
    document.getElementById("quitmeeple").onclick = finishDemo;

    // Register for the endupdate event that fires at the end of each colonyLoop
    // and update the GUI at that time
    GAME.COLONY.addEventListener("endupdate", updateGUI);

    // Begin the Demo by starting the colonyLoop
    GAME.COLONY.colonyLoop();
    
}