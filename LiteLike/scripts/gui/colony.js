"use-strict";
import * as SITEGUI from "./site.js";
import { getStrings } from "../io.js";
import { MAXPOWER } from "../colony.js";

export class TheColonyGUI{
    /**
     * Initializes a new UI handler for TheColony
     * @param {TheColony} colony - The colony object that this UI is referencing
     */
    constructor(colony){
        this.colony = colony;

        this.colony.addEventListener("powerlevelmodified", this.updatePowerLevel.bind(this));
        this.colony.addEventListener("resourcesmodified", this.updateResources.bind(this));
        this.colony.addEventListener("noresources", this.flashResources.bind(this));
    }

    get game() {return this.colony.game;}

    /**
     * Populates the screen with the baseline UI Elements for TheColony
     */
    setupUI(){
        let statpanel = this.game.UI.statuspanel;
        // Create Resource Panel
        statpanel.insertAdjacentHTML('beforeend', '<div id="resourcebox" class="statusbox"><div class="header">Resources<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>')
        // Setup resourcebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("resourcebox"));

        let home = this.game.UI.homecontent;
        // Setup Home Content: we initially setup for a brand new game, and can update later if
        // loading from a save file
        home.insertAdjacentHTML('beforeend', `
<div id="adminPage" style="height:100%; width:100%;">
    <div style="display:inline-flex; width:100%;align-items:center;">
        <div style="width:50%;display:inline-flex;height:3em;">
            <button id="addbatteries">Replace Batteries</button>
            <div id="powerlevel" style="width:100%;height:100%;">
                <svg viewBox="0 0 100 100" style="height:100%;padding-left:5px;">
                    <rect class="mask" width="100%" y="0" height="100%" fill="white"/>
                </svg>
            </div>
        </div>
        <div style="font-weight:bold;">
            Residents: <span id="population"></span>
        </div>
    </div>
    <div style="display:inline-flex;height:100%;width:100%;">
        <fieldset><legend>Sectors</legend></fieldset>
        <fieldset><legend>Construct</legend></fieldset>
    </div>
</div>`);
        // Drawing Battery in loop because it's easier
        let battery = document.querySelector("#powerlevel>svg");
        // Battery has 5 levels
        for(let i = 0; i < 5; i++){
            let level = (i+1) * 20;
            // Bars are added afterbegin so that the Mask is the last drawn box
            // The i offset in 
            battery.insertAdjacentHTML('afterbegin', `<rect x="${level-20+i}%" y="${100-level}%" width="19%" height="${level}%" fill="lawngreen"/>`)
        }



        // Register page on Home
        let button = this.game.UI.registerPage("admin","A Dark Shell");
        this.game.UI.setPage(button);

        // Prepopulate Resources Panel
        // DEVNOTE- updateResources only checks for resourcechange on the object it recieves
        //      Since we're ducktyping we'll have to update below if it requires additional info
        //      in the future
        let resourcechange = [];
        for(let i = 0; i < this.colony.resources.length; i++){
            let qty = this.colony.resources[i];
            // colonyresources is an array with blank spaces in it for items that were never collected
            // If the resource was never collected, skip it
            if(qty === null || typeof qty == "undefined") continue;
            resourcechange.push([i,qty]);
        }
        this.updateResources({resourcechange});

        // Connect powerlevel button 
        // We can connect it to The Colony directly because we'll get feedback via events
        document.getElementById("addbatteries").onclick = ()=>this.colony.increasePowerLevel();

        // Call updatePowerLevel to set the UI's powerlevel
        // DEVNOTE- updatePowerLevel is an event callback, so we're ducktyping the event
        this.updatePowerLevel({powerlevel:this.colony.powerLevel});
    }

    setupSectors(){
        
    }

    /**
     * Indicates on the UI that whatever action was just taken cannot be completed because
     * TheColony lacks resources
     * @param {TheColonyEvent} event - The noresources event of TheColony
     */
    flashResources(event){
        let tbody = document.querySelector("#resourcebox tbody");
        let qty, row;
        for(let id=0; id< event.noresources.length; id++){
            qty = event.noresources[id];
            // noresources is an array where the array index is the missing resource
            // id which means that any resource not missing prior to the final missing
            // resource will be an emtpy array slot
            if(!qty || typeof qty == "undefined") continue;
            row = tbody.querySelector(`tr[data-id="${id}"]`);
            // We don't have that resource to begin with
            // DEVNOTE- this shouldn't really happen during gameplay
            if(!row || typeof row == "undefined") continue;
            SITEGUI.flashText(row);
        }
    }

    /**
     * Updates the resourcebox status box to reflect changes in The Colony's resources
     * @param {TheColonyEvent} event - The resourcesmodified event of The Colony
     */
    updateResources(event){
        /** DEVNOTE- It's possible that- given enough Meeple- there may be too many callbacks
         * to this function in the future; in that case this should be changed to a polling
         * callback which updates every so often
         */
        // Table body within ResourceBox's Status Box
        let tbody = document.querySelector("#resourcebox .body tbody");

        // We do not have the Status Box initialized, so can't update
        if(!tbody || typeof tbody == "undefined") return;
        
        // We may need to resort the Resources if we add additional lines
        let resort = false;

        // Get all the changes
        for(let [resourceid, qty] of event.resourcechange){
            // We don't care about the change amount, we just want to know the current value
            qty = this.colony.getResource(resourceid);

            // Get the row on the StatusBox
            let row = tbody.querySelector(`tr[data-id="${resourceid}"]`);
            // New Resource
            if(!row || typeof row == "undefined"){
                // We could check if this new Resource is supposed to be
                // at the end of the list, but we're going to be lazy and just resort
                resort = true;

                // Need display info
                let info = getStrings(this.game.STRINGS, this.game.ITEMS.resources[resourceid]);

                tbody.insertAdjacentHTML(`beforeend`, `<tr data-id="${resourceid}"><td title="${info.flavor}">${info.name}</td><td data-qty></td></tr>`);
                // We know where that element was inserted, so we don't have to query for it
                row = tbody.lastElementChild;
            }
            // Update qty of the row
            row.querySelector("td[data-qty]").textContent = qty;
        }

        // If we don't have to resort, we're done
        if(!resort) return;

        let rows = [];
        while(tbody.lastElementChild){
            // Add to list
            rows.push(tbody.lastElementChild);
            // Remove from table
            tbody.lastElementChild.remove();
        }

        // Sort Resource rows based on id
        rows.sort((a,b)=>parseInt(a.dataset.id) - parseInt(b.dataset.id));

        // Readd all rows to table
        tbody.append(...rows);
    }

    /**
     * Updates the UI to display the current Power Level
     * @param {TheColonyEvent} event - The powerlevelmodified event of TheColony
     */
    updatePowerLevel(event){
        // We use 5 bars to display our power level, so maxpower/5 is
        // our increments and our current power increment starts at 1
        let i = Math.floor( (this.colony.powerLevel+1) / (MAXPOWER/5));
        console.log(i, i*20+i);
        // We use a mask in order to hide the rest of the powerlevel
        // So to updated we just set the rect's x coord
        document.querySelector("#powerlevel rect.mask").setAttribute('x', `${i*20+i}%`);
    }
}