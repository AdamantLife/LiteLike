"use-strict";
import * as SITEGUI from "./site.js";
import { getStrings, makeTranslationLookup } from "../io.js";
import { MAXPOWER } from "../colony.js";
import { enumerate} from "../utils.js";

/** DEVNOTE- this list needs to be maintained alongside the LANGUAGE jsons */
const STRINGS = enumerate(
    // Status Box
    "RESOURCES",
    // Prefix to append to Exchange/Upgrade costs (i.e.- "[Cost]: 10 Scrap, 2 Batteries")
    "COST",
    // Home Pages
    // Starts on SECTORS because the first tab's name is dynamically generated
    "SECTORPAGE",
    // Home Admin Page, top line
    "ADDBATTERIES","RESIDENTS",
    // Home Admin Page, fieldset legends
    "SECTORUPGRADE", "CONSTRUCT",

    // Power level Description
    "POWERLEVEL0", "POWERLEVEL1", "POWERLEVEL2", "POWERLEVEL3", "POWERLEVEL4", "POWERLEVEL5",
    // Population Description
    "POPULATION0","POPULATION1","POPULATION2","POPULATION3","POPULATION4","POPULATION5",

    // Sector States
    "SECTL0", "SECTL", "SECTLMAX",
    // Sector Upgrade
    "SECTUP0", "SECTUP", "SECTUPMAX",
    // Sector Collect
    "SECTCOLLECT"
)

export class TheColonyGUI{
    /**
     * Initializes a new UI handler for TheColony
     * @param {TheColony} colony - The colony object that this UI is referencing
     */
    constructor(colony){
        this.colony = colony;

        this.translate = makeTranslationLookup(this.colony.game, STRINGS, "colony");

        this.colony.addEventListener("powerlevelmodified", this.updatePowerLevel.bind(this));
        this.colony.addEventListener("resourcesmodified", this.updateResources.bind(this));
        this.colony.addEventListener("noresources", this.flashResources.bind(this));
        this.colony.addEventListener("meeplemodified", this.updateMeeple.bind(this));
        this.colony.addEventListener("sectoradded", this.addSector.bind(this));
        this.colony.addEventListener("sectortriggered", this.sectorCollection.bind(this));
        this.colony.addEventListener("sectorexpanded", this.upgradeSector.bind(this));
    }

    get game() {return this.colony.game;}

    /**
     * Populates the screen with the baseline UI Elements for TheColony
     */
    setupUI(){
        // The current language translation for Colony UI
        let uistrings = this.colony.game.LANGUAGE.colony;

        let statpanel = this.game.UI.statuspanel;
        // Create Resource Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="resourcebox" class="statusbox"><div class="header">${this.translate(STRINGS.RESOURCES)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup resourcebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("resourcebox"));

        let home = this.game.UI.homecontent;
        // Setup Home Content: we initially setup for a brand new game, and can update later if
        // loading from a save file
        home.insertAdjacentHTML('beforeend', `
<div id="adminPage" style="height:100%; width:100%;">
    <div style="display:inline-flex; width:100%;align-items:center;">
        <div style="width:50%;display:inline-flex;height:3em;">
            <button id="addbatteries">${this.translate(STRINGS.ADDBATTERIES)}</button>
            <div id="powerlevel" style="width:100%;height:100%;">
                <svg viewBox="0 0 100 100" style="height:100%;padding-left:5px;">
                    <rect class="mask" width="100%" y="0" height="100%" fill="white"/>
                </svg>
            </div>
        </div>
        <div style="font-weight:bold;">
            ${this.translate(STRINGS.RESIDENTS)}: <span id="population"></span>
        </div>
    </div>
    <div style="display:inline-flex;height:100%;width:100%;">
        <fieldset><legend>${this.translate(STRINGS.SECTORUPGRADE)}</legend><table><tbody id="adminSectors"></tbody></table></fieldset>
        <fieldset id="shop"><legend>${this.translate(STRINGS.CONSTRUCT)}</legend></fieldset>
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
        let button = this.game.UI.registerPage("admin","");
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

        // As above, spoofing a meeplemodified event in order to prepopulate the population span
        this.updateMeeple({newmeeple:0});

        // If The Colony has Sectors unlocked, set it up
        if(!this.colony.checkUnlocks("SECTORS").length) this.setupSectors();
    }

    setupSectors(){
        let home = this.game.UI.homecontent;
        home.insertAdjacentHTML('beforeend', `<div id="sectorsPage" style="display:none;"><table><tbody id="sectortable"></tbody></table></div>`);
        this.game.UI.registerPage("sectors", this.translate(STRINGS.SECTORPAGE));
    }

    /**
     * Useful function for turning level up costs to readable string
     * @param {Array[]} requirements - An array of length-2 arrays containing resourceid and quantity
     * @returns {String} - The readable Resource Costs to level
     */
     constructCost(requirements){
        // The output string starts with "Requires:" and then newline-concats each requirement
        let costString = `${this.translate(STRINGS.COST)}:`;
        if(!requirements.length) return costString + ` ${this.game.UI.translate(this.game.UI.STRINGS.NONE)}`;
        for(let [resource, qty] of requirements){
            let resourceString = getStrings(this.game.STRINGS, this.game.ITEMS.resources[resource]);
            costString += `
    ${resourceString.name}: ${qty}`;
            }
            return costString
        }

    
    /**
     * @typedef {Object} ColonyDescriptor
     * @property {String} power - A description of the current power level of The Colony
     * @property {String} population - A description of the current population level of The Colony
     */
    /**
     * Provides a description of the state of the PowerLevel and Population of The Colony
     * @returns {ColonyDescriptor} - An object describing the current state of The Colony
     */
    getDescriptor(){
        // Get powerlevel index
        let index = Math.ceil(this.colony.powerLevel / 2);
        // Get translated string to display
        let power = this.translate(STRINGS["POWERLEVEL"+index]);
        // Get population index
        index = Math.ceil(this.colony.meeples.length / 10)
        // Get translated string to display
        let population = this.translate(STRINGS["POPULATION"+index]);
        // Return both
        return {power, population};
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
     * Updates the UI to display the current Power Level and updates the Displayed Name
     * @param {TheColonyEvent} event - The powerlevelmodified event of TheColony
     */
    updatePowerLevel(event){
        // We use 5 bars to display our power level, so maxpower/5 is
        // our increments and our current power increment starts at 1
        let i = Math.floor( (this.colony.powerLevel+1) / (MAXPOWER/5));
        // We use a mask in order to hide the rest of the powerlevel
        // So to updated we just set the rect's x coord
        document.querySelector("#powerlevel rect.mask").setAttribute('x', `${i*20+i}%`);

        // Update the name
        let description = this.getDescriptor();
        document.getElementById("admin").textContent = `A ${description.power} ${description.population}`;
    }

    /**
     * Updates the number of meeple currently displayed
     * @param {TheColonyEvent} event - TheColony's meeplemodified event
     */
    updateMeeple(event){
        // As with other GUI updates in this class, we're going to just query TheColony directly
        document.getElementById("population").textContent = this.colony.meeples.length;
    }

    /**
     * Updates the UI when a sector is unlocked
     * @param {TheColonyEvent} event - TheColony's sectoradded event
     */
    addSector(event){
        let sector = event.sector;
        let strings = getStrings(this.game.STRINGS, sector);

        // Add sector level ups to the adminPage
        let admin = document.getElementById("adminSectors");
        let state = STRINGS.SECTL0;
        let upgrade = STRINGS.SECTUP0;
        if(sector.level){
            state = STRINGS.SECTL;
            upgrade = STRINGS.SECTUP;
            if(sector.level == sector.maxLevel){
                state = STRINGS.SECTLMAX;
                upgrade = STRINGS.SECTUPMAX;
            }
        }
        admin.insertAdjacentHTML('beforeend', `
<tr data-sector="${sector.sectorType.description}">
    <td title="${strings.flavor}">${strings.name}</td>
    <td data-state>${this.translate(state)}</td>
    <td><button data-upgrade${sector.level == sector.maxLevel ? ' disabled style="display=none;"' :  ` title="${this.constructCost(sector.calculateResourceRequirements())}"`}>${this.translate(upgrade)}</button></td>
</tr>`);
        admin.lastElementChild.querySelector("button").onclick = ()=>sector.raiseLevel(this.colony);

        // Add sector to the SectorsPage
        let sectorTable = document.getElementById("sectortable");
        // sectors hasn't been setup yet
        if(!sectorTable || typeof sectorTable == "undefined"){ this.setupSectors(); sectorTable = document.getElementById("sectortable");}
        // Remaining is how much time is left
        let remaining = Math.ceil(sector.timer.remaining());
        // We want to setup the Progressbar so that it knows how much time has already passed
        let progress = sector.timer.rate - remaining;
        // Setup the Sector's row
        // For this first 
        sectorTable.insertAdjacentHTML("beforeend", `
<tr data-sector="${sector.sectorType.description}">
    <td title="${strings.flavor}">${strings.name}</td>
    <td class="task progress">
        <div class="progressbar"><div class="inner" style="animation-duration:${sector.timer.rate}ms;"></div></div>
        <button>${this.translate(STRINGS.SECTCOLLECT)}</button>
    </td>
</tr>`);
        let td = sectorTable.lastElementChild.querySelector("td.task");
        
        // Hookup collect button
        td.querySelector("button").onclick = ()=>this.colony.triggerSector(sector);
        // All animation happens on the progressbar's >.inner element
        let progressbar = td.querySelector(`div.progressbar>.inner`);
        // Add animation callback to switch from progressbar to collect button
        // We're also clearing warmup so we don't have to do it later
        let changecallback = (event)=>{td.querySelector("div.progressbar").classList.remove("warmup"); td.classList.remove("progress"); td.classList.add("collect");};
        progressbar.addEventListener("animationend", changecallback);

        // If the sector timer is ready and is frozen, call the changecallback now
        if(sector.timer.isReady && sector.timer.isFrozen){
            changecallback();
        }
        // If the sector is being added mid-cycle
        else if(progress){
            // Modify progressbar to only show part of its animation on the first run
            // After this run, it will cycle normally
            // Set current width
            progressbar.style.width = Math.floor(progress / sector.timer.rate*100) + "%";
            // Set current color
            // Start=Yellow, End = Red
            progressbar.style.backgroundColor = SITEGUI.calcColorTransition("#ffff00", "ff0000",sector.timer.rate, progress);
            // Set transition duration to match remaining timte
            progressbar.style.transitionDuration = remaining+"ms";
            // Set animation callback to clear all these duration and manually swap 
            let callback = (event)=>{progressbar.removeEventListener("transitionend", callback); SITEGUI.clearPartialProgress(event); changecallback(event);}
            progressbar.addEventListener("transitionend", callback);
            // Begin animating
            // DEVNOTE- We need to set a reasonably large offset before animating
            //          otherwise the browswer will not animation will not show
            window.setTimeout(()=>{progressbar.style.backgroundColor = "red";
            progressbar.style.width = "100%";},700);
        }
        // If the sector has levels (and therefore is cycling)
        else if(sector.level){
            // Add the warmup class to show that it's cycling normally
            td.querySelector("div.progressbar").classList.add("warmup");
        }
        // Sector has no levels
        else{
            // Disable it
            td.querySelector("div.progressbar").classList.add("disabled");
        }
    }

    /**
     * When a sector is triggered it goes back on cooldown/warmup, so adjust the UI
     * @param {TheColonyEvent} event - TheColony's sectortriggered event
     */
    sectorCollection(event){
        let sector = event.sector;
        let td = document.querySelector(`#sectortable tr[data-sector="${sector.sectorType.description}"]>td.task`);
        // Swap what element is showing
        td.classList.remove("collect");
        td.classList.add("progress");
        // Start warmup on progressbar
        td.querySelector("div.progressbar").classList.add("warmup");
    }

    /**
     * When a sector is upgraded, adjust UI
     * @param {TheColonyEvent} event - TheColony's sectorexpanded event
     */
    upgradeSector(event){
        // Get updated state and upgrade strings
        let state = STRINGS.SECTL0;
        let upgrade = STRINGS.SECTUP0;
        if(event.sector.level){
            state = STRINGS.SECTL;
            upgrade = STRINGS.SECTUP;
            if(event.sector.level == event.sector.maxLevel){
                state = STRINGS.SECTLMAX;
                upgrade = STRINGS.SECTUPMAX;
            }
        }

        // Get sector's row for reference
        let row = document.querySelector(`#adminSectors tr[data-sector="${event.sector.sectorType.description}"]`);
        
        // Update the state's text
        row.querySelector("td[data-state]").innerText = this.translate(state);

        // Making various updates on the button
        let button = row.querySelector("button[data-upgrade]");

        // Set button text
        button.innerText = this.translate(upgrade);

        // sector can't be upgraded anymore, so remove(hide/disable) button
        if(event.sector.level == event.sector.maxLevel){
            button.disabled = true;
            button.style.display="none"
        }else{
            // Otherwise (sector can be upgraded) change tooltip to reflect new cost
            button.setAttribute("title",this.constructCost(event.sector.calculateResourceRequirements()));
        }

        // Sector is now available to be collected from 
        if(event.sector.level == 1){
            // Get the progressbar
            let progressbar = document.querySelector(`#sectortable>tr[data-sector="${event.sector.sectorType.description}"]>td.task>div.progressbar`);
            // Remove disabled
            progressbar.classList.remove("disabled");
            // Add warmup to the progressbar for the given row
            progressbar.classList.add("warmup");
        }
    }
        
}

