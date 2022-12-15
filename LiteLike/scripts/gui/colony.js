"use-strict";
import * as SITEGUI from "./site.js";
import { getStrings, makeTranslationLookup } from "../io.js";
import { MAXPOWER, sectors, TheColony } from "../colony.js";
import { enumerate} from "../utils.js";

/** DEVNOTE- this list needs to be maintained alongside the LANGUAGE jsons */
const STRINGS = enumerate(
    // Prefix to append to Exchange/Upgrade costs (i.e.- "[Cost]: 10 Scrap, 2 Batteries")
    "COST",
    // Home Pages
    // Starts on SECTORS because the first tab's name is dynamically generated
    "SECTORPAGE", "MEEPLEPAGE",
    // Home Admin Page, top line
    "ADDBATTERIES","RESIDENTS",
    // Home Admin Page, fieldset legends
    "SECTORUPGRADE", "SHOP",
    // Shop Fieldset Exchange Button
    "EXCHANGE",

    // Power level Description
    "POWERLEVEL0", "POWERLEVEL1", "POWERLEVEL2", "POWERLEVEL3", "POWERLEVEL4", "POWERLEVEL5",
    // Population Description
    "POPULATION0","POPULATION1","POPULATION2","POPULATION3","POPULATION4","POPULATION5",

    // Sector States
    "SECTL0", "SECTL", "SECTLMAX",
    // Sector Upgrade
    "SECTUP0", "SECTUP", "SECTUPMAX",
    // Sector Collect
    "SECTCOLLECT",

    // Meeple Page
    // Fieldset legends
    "JOBS","INCOME"
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
        this.colony.addEventListener("resourcesmodified", this.updateStatusbox.bind(this));
        // These are bound in setupShop, but noted here for reference
        // this.colony.addEventListener("itemsmodified", this.updateStatusbox.bind(this));
        // this.colony.addEventListener("weaponsmodified", this.updateStatusbox.bind(this));
        // this.colony.addEventListener("resourcesmodified", this.updateShop.bind(this));
        this.colony.addEventListener("noresources", this.flashResources.bind(this));
        this.colony.addEventListener("sectoradded", this.addSector.bind(this));
        this.colony.addEventListener("sectortriggered", this.sectorCollection.bind(this));
        this.colony.addEventListener("sectorexpanded", this.upgradeSector.bind(this));
        // This is bound in setupMeeple, but noted here for reference
        // this.colony.addEventListener("meeplemodified", this.updateMeeple.bind(this));
        // this.colony.addEventListener("unlockadded", this.updateJobsAvailable.bind(this));
        // this.colony.addEventListener("jobsmodified", this.updateJobs.bind(this));
        // This is bound in setupShop, but noted here for reference
        //this.game.PLAYER.addEventListener("equipmentchange", this.updateArmorTransport.bind(this));
    }

    get game() {return this.colony.game;}

    /**
     * Populates the screen with the baseline UI Elements for TheColony
     */
    setupUI(){
        let statpanel = this.game.UI.statuspanel;
        // Create Resource Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="resourcesbox" class="statusbox"><div class="header">${this.game.UI.translate(this.game.UI.STRINGS.RESOURCES)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup resourcebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("resourcesbox"));

        let home = this.game.UI.homecontent;
        // Setup Home Content: we initially setup for a brand new game, and can update later if
        // loading from a save file
        home.insertAdjacentHTML('beforeend', `
<div id="adminPage" style="height:100%; width:100%;">
    <div id="adminTopBar" style="display:inline-flex; width:100%;align-items:center;">
        <div style="width:50%;display:inline-flex;height:3em;">
            <button id="addbatteries">${this.translate(STRINGS.ADDBATTERIES)}</button>
            <div id="powerlevel" style="width:100%;height:100%;">
                <svg viewBox="0 0 100 100" style="height:100%;padding-left:5px;">
                    <rect class="mask" width="100%" y="0" height="100%" fill="white"/>
                </svg>
            </div>
        </div>
    </div>
    <div id="adminFields" style="display:inline-flex;width:100%;">
        <fieldset><legend>${this.translate(STRINGS.SECTORUPGRADE)}</legend><table><tbody id="adminSectors"></tbody></table></fieldset>
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
        // DEVNOTE- updateStatusbox checks for eventtype and resourcechange on the object it recieves
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
        this.updateStatusbox({eventtype: TheColony.EVENTTYPES.resourcesmodified, resourcechange});

        // Connect powerlevel button 
        // We can connect it to The Colony directly because we'll get feedback via events
        document.getElementById("addbatteries").onclick = ()=>this.colony.increasePowerLevel();

        // Call updatePowerLevel to set the UI's powerlevel
        // DEVNOTE- updatePowerLevel is an event callback, so we're ducktyping the event
        this.updatePowerLevel({powerlevel:this.colony.powerLevel});

        // If The Colony has Sectors unlocked, set it up
        if(!this.colony.checkUnlocks("SECTORS").length) this.setupSectors();
        // If the Gampeplaysequence has the Shop unlocked, set it up
        if(!this.game.GAMEPLAYSEQUENCE.checkFlags("SHOP").length) this.setupShop();
        // If The Colony has the Residential Sector unlocked, set it up
        if(this.colony.sectors.indexOf(sectors.RESIDENTIAL) >= 0) this.setupMeeple();
    }

    setupSectors(){
        let home = this.game.UI.homecontent;
        home.insertAdjacentHTML('beforeend', `<div id="sectorsPage"><table><tbody id="sectortable"></tbody></table></div>`);
        this.game.UI.registerPage("sectors", this.translate(STRINGS.SECTORPAGE));
    }

    setupShop(){
        // Add Items and Weapons to the sidebar
        let statpanel = this.game.UI.statuspanel;
        // Create Resource Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="itemsbox" class="statusbox"><div class="header">${this.game.UI.translate(this.game.UI.STRINGS.ITEMS)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup resourcebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("itemsbox"));
        // Create Resource Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="weaponsbox" class="statusbox"><div class="header">${this.game.UI.translate(this.game.UI.STRINGS.WEAPONS)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup resourcebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("weaponsbox"));

        // Add listeners to update the sidebar
        this.colony.addEventListener("itemsmodified", this.updateStatusbox.bind(this));
        this.colony.addEventListener("weaponsmodified", this.updateStatusbox.bind(this));

        // Prepopulate Both Panels
        // See setupUI for additional documentation
        let change = [];
        for(let i = 0; i < this.colony.items.length; i++){
            let qty = this.colony.items[i];
            if(qty === null || typeof qty == "undefined") continue;
            change.push([i,qty]);
        }
        this.updateStatusbox({eventtype: TheColony.EVENTTYPES.itemsmodified, itemchange:change});
        change = [];
        for(let i = 0; i < this.colony.weapons.length; i++){
            let qty = this.colony.weapons[i];
            if(qty === null || typeof qty == "undefined") continue;
            change.push([i,qty]);
        }
        this.updateStatusbox({eventtype: TheColony.EVENTTYPES.weaponsmodified, weaponchange:change});

        // Add fieldset to Admin Page
        document.getElementById("adminFields").insertAdjacentHTML('beforeend', `
<fieldset id="shop"><legend>${this.translate(STRINGS.SHOP)}</legend>
<h2>${this.game.UI.translate(this.game.UI.STRINGS.RESOURCES)}</h2>
<table><tbody id="shopresources"></tbody></table>
<h2>${this.game.UI.translate(this.game.UI.STRINGS.ITEMS)}</h2>
<table><tbody id="shopitems"></tbody></table>
<h2>${this.game.UI.translate(this.game.UI.STRINGS.WEAPONS)}</h2>
<table><tbody id="shopweapons"></tbody></table>
<h2>${this.game.UI.translate(this.game.UI.STRINGS.ARMOR)}</h2>
<table><tbody id="shoparmor"></tbody></table>
<h2>${this.game.UI.translate(this.game.UI.STRINGS.TRANSPORTS)}</h2>
<table><tbody id="shoptransports"></tbody></table>
</fieldset>`);

        // Gather list to prepopulate shop
        let resources = [];
        for(let id = 0; id < this.colony.resources; id++){
            let qty = this.colony.resources[id];
            // We do not actually have that resource
            if(typeof qty == "undefined")continue;
            // Add resource to resource,qty array
            resources.push([id, qty]);
        }

        // Attach listener for updateShop
        this.colony.addEventListener("resourcesmodified", this.updateShop.bind(this));

        // As always, spoof resourcesmodified event to call updateShop listener callback
        this.updateShop({resourcechange: resources});

        // Attach listener for availability of armor and transports
        this.game.PLAYER.addEventListener("equipmentchange", this.updateArmorTransport.bind(this));

        this.updateArmorTransport({subtype:"armor", item: this.game.PLAYER.armor});
        this.updateArmorTransport({subtype:"transport", item: this.game.PLAYER.transport});
    }

    setupMeeple(){
        // Add resident count to admin page
        document.querySelector("#adminTopBar").insertAdjacentHTML('beforeend',`<div style="font-weight:bold;">
        ${this.translate(STRINGS.RESIDENTS)}: <span id="population"></span>
    </div>`);

        let home = this.game.UI.homecontent;
        home.insertAdjacentHTML('beforeend', `<div id="meeplePage"><fieldset><legend>${this.translate(STRINGS.JOBS)}</legend><table><tbody id="jobtable"></tbody></table></fieldset><fieldset><legend>${this.translate(STRINGS.INCOME)}</legend><table><tbody id="incometable"></tbody></table></fieldset></div>`);
        this.game.UI.registerPage("meeple", this.translate(STRINGS.MEEPLEPAGE));

        // Setup callback for Job management arrows
        // DEVNOTE- Due to the number of arrows per job and the potential number of jobs
        //      that could be displayed, we're going to capture at the table level and
        //      delegate from there.
        document.getElementById("jobtable").addEventListener("click", this.adjustJobMeeple.bind(this));

        // Updates number of meeple on admin and meeple pages
        this.colony.addEventListener("meeplemodified", this.updateMeeple.bind(this));
        // Updates jobs available and job income
        this.colony.addEventListener("unlockadded", this.updateJobsAvailable.bind(this));
        // Updates Meeple's Jobs
        this.colony.addEventListener("jobsmodified", this.updateJobs.bind(this));
        
        // updateJobsAvailable doesn't actually use anything from the unlockadded event
        // NOTE- we have to call this before updateMeeple because updateMeeple
        //      manipulates the job and income tables
        this.updateJobsAvailable({});
        // Spoofing a meeplemodified event in order to prepopulate the population span
        this.updateMeeple({newmeeple:this.colony.meeples.length});
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
        let tbody = document.querySelector("#resourcesbox tbody");
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
     * Updates a statusbox to reflect changes in The Colony's storage
     * @param {TheColonyEvent} event - One of the *modified events of The Colony
     */
    updateStatusbox(event){
        /** DEVNOTE- It's possible that- given enough Meeple- there may be too many callbacks
         * to this function in the future for Resources; in that case this should be changed to a polling
         * callback which updates every so often
         */

        let type, lookup;
        // Determine the type so we can get necessary references
        // and lookup on the colony
        switch (event.eventtype){
            case TheColony.EVENTTYPES.resourcesmodified:
                type = "resource";
                lookup = this.colony.getResource.bind(this.colony);
                break;
            case TheColony.EVENTTYPES.itemsmodified:
                type = "item";
                lookup = this.colony.getItem.bind(this.colony);
                break;
            case TheColony.EVENTTYPES.weaponsmodified:
                type = "weapon";
                lookup = this.colony.getWeapon.bind(this.colony);
                break;
        }
        
        if(!type) return;
        // Table body within ResourceBox's Status Box
        let tbody = document.querySelector(`#${type}sbox .body tbody`);

        // We do not have the Status Box initialized, so can't update
        if(!tbody || typeof tbody == "undefined") return;
        
        // We may need to resort the Resources if we add additional lines
        let resort = false;


        // Get all the changes
        for(let [id, changeqty] of event[`${type}change`]){
            // We don't care about the change amount, we just want to know the current value
            let qty = lookup(id);

            // Get the row on the StatusBox
            let row = tbody.querySelector(`tr[data-id="${id}"]`);
            // New Resource
            if(!row || typeof row == "undefined"){
                // We could check if this new Resource is supposed to be
                // at the end of the list, but we're going to be lazy and just resort
                resort = true;

                // Need display info
                let info = getStrings(this.game.STRINGS, this.game.ITEMS[`${type}s`][id]);

                tbody.insertAdjacentHTML(`beforeend`, `<tr data-id="${id}"><td title="${info.flavor}">${info.name}</td><td data-qty></td></tr>`);
                // We know where that element was inserted, so we don't have to query for it
                row = tbody.lastElementChild;
            }
            // Update qty of the row
            row.querySelector("td[data-qty]").textContent = qty;
            // Flash for feedback
            // Note that we don't use Red because Red indicates Insufficient Resources
            // Magenta for negative
            let color = "magenta";
            // Green for positive
            if(changeqty > 0) color = "green";
            SITEGUI.flashText(row, {color});
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
     * Checks to see if any new jobs are available to the Meeple
     * @param {TheColonyEvent} event - TheColony's unlockadded event
     */
        updateJobsAvailable(event){
        // Get all available jobs
        let jobs = this.colony.availableJobs();

        // Get reference to tables that need updating
        let jobtable = document.getElementById("jobtable");
        let incometable = document.getElementById("incometable");

        // Check if we have to resort the job or income table
        let jobresort = false;
        let incomeresort = false;
        // If we added a job, then we necessarily have resort the incomebreakdown
        // for each resource it is part of, so we keep a list
        let breakdownresort = [];

        for(let job of jobs){
            // For each job, check if it's new by checking the jobtable
            let row = jobtable.querySelector(`tr[data-id="${job.id}"]`);

            // This job is not new, so skip it
            if(row && typeof row !== "undefined") continue;

            // Otherwise, we need to add it
            let jobstrings = getStrings(this.game.STRINGS, job);

            // Jobs other than job.id==0 (Grow Food) can be toggled +- meeple
            // Grow food is the default Job, so it acts as the pool from which all
            // other jobs pull from
            let toggle = `<td><table><tbody>
            <tr><td class="plusmeeple"></td><td class="plusmeeple plustenmeeple"></td></tr>
            <tr><td class="minusmeeple"></td><td class="minusmeeple minustenmeeple"></td></tr>
        </tbody></table></td>`
            if(job.id == 0) toggle = ``;

            jobtable.insertAdjacentHTML('beforeend', `
<tr data-id="${job.id}">
    <td title="${jobstrings.flavor}">${jobstrings.name}</td>
    <td data-meeple>0</td>
    ${toggle}
</tr>`);
            // Since we added a row to the jobtable, we need to resort it
            jobresort = true;

            // Also need to update the Income table
            // We're going to iterate over resourceGenerated and resourcesRequired
            // at the same time. The qty ends up being unnecessary as updateMeeple
            // do the math with the qty
            for(let [resource, qty] of [
                    ...job.resourcesGenerated,
                    ...job.resourcesRequired
                ]){
                // Get the row to modify it
                let row=incometable.querySelector(`tr[data-id="${resource}"]`);
                // Resource hasn't been added to income table yet
                if(!row || typeof row == "undefined"){
                    // The resource in Generated/Required is only an ID, so we need to convert
                    // it to an object to get strings
                    let strings = getStrings(this.game.STRINGS, this.game.ITEMS.resources[resource]);

                    // Breakdown total row is id=10000 on the assumption that this will be higher
                    // than any job id that will be added to the table 
                    incometable.insertAdjacentHTML('beforeend', `<tr data-id="${resource}"><td title="${strings.flavor}">${strings.name}</td><td class="income"><span>+0</span><table><tbody class="incomebreakdown"><tr class="total" data-id="10000"><td>Total</td><td><span data-rate>+0</span> per 10 Seconds</td></tr></tbody></table></td></tr>`);
                    row =incometable.lastElementChild;

                    // Since we added a row to the incometable, we need to resort it
                    incomeresort = true;
                }

                // Add Job's qty to breakdown
                let breakdown = row.querySelector("tbody.incomebreakdown");
                // We're going to be resorting anyway, so we can add the row to the end
                // Not setting the qty now, as that is set by meeple
                breakdown.insertAdjacentHTML('beforeend', `<tr data-id="${job.id}"><td>${jobstrings.name}</td><td><span data-rate>+0</span> per 10 Seconds</td></tr>`);

                // Breakdown needs to be resorted
                breakdownresort.push(breakdown);
            }
        }

        // We did not add any new jobs, so do nothing
        if(!jobresort) return;

        // Sort the jobs by Job ID
        SITEGUI.sortTableBody(jobtable);

        // Since we added jobs, we also need to resort breakdowns
        for(let breakdown of breakdownresort){
            SITEGUI.sortTableBody(breakdown);
        }
        
        // Adding a job does not necessarily change the income table
        if(incomeresort){
            // Otherwise, it gets resorted exactly like everything
            SITEGUI.sortTableBody(incometable);
        }
    }

    /**
     * Updates the number of meeple doing each job and that job's income contribution
     * @param {TheColonyEvent} event - TheColony's jobsmodified event
     */
    updateJobs(event){
        // No Meeple to adjust
        if(!event.meeple || typeof event.meeple == "undefined" || !event.meeple.length) return;

        // We actually only care about the quantity of meeple
        let qty = event.meeple.length;
        
        // From and to are modified in the same way
        for(let [job, dqty] of [ [event.from, -qty], [event.to, qty]]){
            // DEVNOTE- Since we know we're only modifying two jobs, we'll
            // let adjustJobMeeple update the Income Totals
            this.updateJobMeeple(job, dqty);
        }

        // Update Free Meeple
        this.updateFreeMeeple();
    }

    /**
     * Updates the number of Meeple currently displayed based on meeplemodified .newmeeple and .deadmeeple
     * @param {TheColonyEvent} event - TheColony's meeplemodified event
     */
    updateMeeple(event){
        // Just query colony directly for new total number of meeple on the admin page
        document.getElementById("population").textContent = this.colony.meeples.length;

        // Keeping track of changes to jobs
        let jobs = {};

        // Meeple have been added
        if(event.newmeeple && typeof event.newmeeple !== "undefined"){
            // Log each Meeple's job
            for(let meeple of event.newmeeple){
                if(typeof jobs[meeple.job.id] == "undefined") jobs[meeple.job.id] = {job:meeple.job, qty:0};
                jobs[meeple.job.id].qty+=1;
            }
        }
        // Meeple have been removed
        if(event.deadmeeple && typeof event.deadmeeple !== "undefined"){
            // Log each dead meeple's job
            for(let meeple of event.deadmeeple){
                if(typeof jobs[meeple.job.id] == "undefined") jobs[meeple.job.id] = {job:meeple.job, qty:0};
                jobs[meeple.job.id].qty-=1;
            }
        }

        // Keeping track of which incomes we need to recalculate
        // We're waiting to update this until after we're done handling each job
        let updateincometotals = [];
        // Update tables based on changes to jobs
        for(let [jobid, obj] of Object.entries(jobs)){
            let resourcesModified = this.updateJobMeeple(obj.job, obj.qty, false);

            // Only add each resource row to the update array once
            for(let resourcerow of resourcesModified){
                if(updateincometotals.indexOf(resourcerow) < 0) updateincometotals.push(resourcerow);
            }
        }

        // Update the income totals now that we're all done
        this.updateIncomeTotal(...updateincometotals);

        // Update Free Meeple
        this.updateFreeMeeple();
    }

    /**
     * Updates the UI for the given job based on the given number of Meeple (which may be negative).
     * Includes updating total meeple for the job, the minusmeeple arrows for it, its income contributions,
     * and- optionally- updating the totals for all its affected income contributions.
     * @param {Job} job - The job to modify the UI for
     * @param {Number} qty - The number of Meeples to account for
     * @param {Boolean} [updateIncomeTotal=true] - Whether or not to also update the income totals for affected incomes.
     * @returns {Element[]} - An array of Income Resource Rows which were modified by this function
     */
    updateJobMeeple(job, qty, updateIncomeTotal = true){
        // Get job's row
        let jobrow = document.querySelector(`#jobtable tr[data-id="${job.id}"]`);
        // Update meeple count
        let meepletd = jobrow.querySelector(`td[data-meeple]`);
        // Save numeric value for later
        let newmeeple = parseInt(meepletd.innerText) + qty;
        meepletd.innerText = newmeeple;
        
        // Update minus arrows, if we don't have any meeple, can't subtract meeple
        if(newmeeple <= 0){
            jobrow.querySelectorAll("td.minusmeeple").forEach((ele)=>ele.classList.add("disabled"));
        }else{
            jobrow.querySelectorAll("td.minusmeeple").forEach((ele)=>ele.classList.remove("disabled"));
        }

        // List of Incomes that will need to have their totals updated
        let updateincometotals = [];

        // Update income breakdowns
        // Required needs to be inverted as it is subtracting from the income
        for(let [resource, rqty] of [
            ... job.resourcesGenerated,
            ... job.resourcesRequired.map(([resource, qty])=>[resource, -qty])
        ]){
            // The income rate is displayed per-10 second interval, so we need to convert
            // the job's resource-qty-per-cycle to match. collectionTime is in ms, so we'll
            // convert 10 seconds to 10000ms to match, then multiply rqty by the 10s/cT ratio
            let rate = 10000/job.collectionTime*rqty;

            let resourcerow = incometable.querySelector(`tr[data-id="${resource}"]`);
            let breakdownrow =  resourcerow.querySelector(`tbody.incomebreakdown>tr[data-id="${job.id}"]`);
            let ratespan = breakdownrow.querySelector(`span[data-rate]`);
            // Note that qty here is qty of meeple
            let newRate = parseFloat(ratespan.innerText) + (rate * qty);
            // Show sign of number on span
            ratespan.innerText = newRate >= 0 ? "+"+newRate : "-"+newRate;
            
            // We need to recalculate resourcerow's total once we're done going through all the jobs
            if(updateincometotals.indexOf(resourcerow) < 0) updateincometotals.push(resourcerow);
        }

        // if updateIncomeTotal, do so
        if(updateIncomeTotal) this.updateIncomeTotal(...updateincometotals);

        // Return all rows that had their incomes changed
        return updateincometotals;
    }

    /**
     * For each provided row of the Income Table, calculate and update its current value both on the toplevel
     * and hover (breakdown) table
     * @param  {...Element} incomes - The resource rows in the Income table to update the Total for
     */
    updateIncomeTotal(...incomes){
        // Update income totals
        for(let resourcerow of incomes){
            // Get reference to both total elements
            let totalspan = resourcerow.querySelector("td.income>span");
            let breakdowntotalspan = resourcerow.querySelector("tbody.incomebreakdown>tr.total>td>span[data-rate]");

            // Keep a running total for rate
            let rate = 0;
            // Iterate over all breakdown rows that are not totalrow
            for(let breakdownrow of resourcerow.querySelectorAll("tbody.incomebreakdown>tr:not(.total)")){
                // Add the breakdown row's rate to the running rate total
                rate+=parseFloat(breakdownrow.querySelector("span[data-rate").innerText);
            }
            // Set new total rate
            // Since we have to apply the sign to both elements, only convert to string once
            rate = rate >= 0 ? "+"+rate : "-"+rate;
            totalspan.innerText = rate;
            breakdowntotalspan.innerText = rate;
        }
    }


    /**
     * Updates the Up Arrows on the Meeple Job Table to reflect how many Meeple are available
     * to be assigned to the job
     */
    updateFreeMeeple(){
        let jobtable = document.getElementById("jobtable");
        // Determine how many meeple are doing Job.id=0 (Gather Food)
        let freemeeple = jobtable.querySelector('tr[data-id="0"]>td[data-meeple]');
        freemeeple = parseInt(freemeeple.innerText);
        
        // No free meeple, so disable all all plusmeeple arrows
        if(!freemeeple){
            jobtable.querySelectorAll("td.plusmeeple").forEach((ele)=>ele.classList.add("disabled"));
        }else{
            // Otherwise, we can atleast increment by 1
            jobtable.querySelectorAll("td.plusmeeple").forEach((ele)=>ele.classList.remove("disabled"));
            // But if we have less than 10, we can't increment by 10
            if(freemeeple < 10) jobtable.querySelectorAll("td.plustenmeeple").forEach((ele)=>ele.classList.add("disabled"));
        }
    }


    /**
     * Checks to see if TheColony has gotten a new resource: if it has, unlock all items that
     * are now available for purchase.
     * 
     * @param {TheColonyEvent} event TheColony's resourcesmodified event
     */
    updateShop(event){
        let shop = document.getElementById("shop");
        
        /**
         * DEVNOTE- It didn't seem like we were saving much time by filtering
         *   ShopItems by the resources in event.resourcechange, so we're
         *  just iterating over all items
         */

        // Check for purchaseable items
        for(let itemkey of ["resources", "items", "weapons", "armor", "transports"]){

            for(let item of this.game.ITEMS[itemkey]){
                // If resource already in shop, skip it
                if(shop.querySelector(`#shop${itemkey} tr[data-id="${item.id}"]`)) continue;
                // Otherwise, check if we can purchase it
                // If not, we'll skip it
                if(!item.isAvailable(this.colony)) continue;
                // otherwise, add it to the table
                let strings = getStrings(this.game.STRINGS, item);
                shop.querySelector(`#shop${itemkey}`).insertAdjacentHTML('beforeend', `<tr data-id="${item.id}">
    <td title="${strings.flavor}">${strings.name}</td>
    <td><button title="${this.constructCost(item.shopCost)}">${this.translate(STRINGS.EXCHANGE)}</button></td>
</tr>`);
                let button = shop.querySelector(`#shop${itemkey}`).lastElementChild.querySelector("button");
                // attach callback
                button.onclick = ()=>this.colony.purchaseItem(item);
                // If armor/transport, check if on player
                if(itemkey == "armor" && item == this.game.PLAYER.equipment.armor) button.disabled = true;
                else if(itemkey == "transport" && item == this.game.PLAYER.equipment.transport) button.disabled = true;
            }
        }
    }

    /**
     * Updates shop availability of armor and transports when the corresponding item changes on the player
     * @param {CharacterEvent} event - The Character equipmentchange event
     */
    updateArmorTransport(event){
        // Not the type of event we're looking for
        if(event.subtype !== "armor" && event.subtype !== "transport") return;
        // Get references
        // Have to add the "s" on to transport because that's how the tables and GAME.ITEMS is setup
        let table = `#shop${event.subtype}${event.subtype == "transport" ? "s" : ""}`;
        let equipment = this.game.PLAYER.equipment[event.subtype];
        // We only need the equipment's id
        if(equipment && typeof equipment !== "undefined") equipment = equipment.id
        // Use an id of -1 so it never matches anything
        else { equipment = -1; }

        // Iterate over all items in the given table
        for(let row of document.querySelectorAll(`${table}>tr`)){
            let itembutton = row.querySelector("button");
            // Assume that they are available first
            itembutton.disabled = false;
            // If it's the same armor/transport the player currently has equipped, disable it
            if(row.dataset.id == equipment) itembutton.disabled = true;
        }
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

        // If the Residential sector has been added, setup Meeple
        // DEVNOTE- Have to do this check here because RESIDENTIAL is !autofreeeze
        //      which means we are exiting on the next if-statement
        //      (i.e.- This is our last chance to check)
        if(sector.sectorType == sectors.RESIDENTIAL) this.setupMeeple();

        // Some sectors auto collect, so we don't add them to the Sectors Page
        if(!sector.timer.autofreeze) return;
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

        // If the Sector is one that can be Collected from (its timer
        // autofreezes and does not progress until cleared), it is now
        // available to be collected from 
        if(event.sector.autofreeze && event.sector.level == 1){
            // Get the progressbar
            let progressbar = document.querySelector(`#sectortable>tr[data-sector="${event.sector.sectorType.description}"]>td.task>div.progressbar`);
            // Remove disabled
            progressbar.classList.remove("disabled");
            // Add warmup to the progressbar for the given row
            progressbar.classList.add("warmup");
        }
    }

    /**
     * Adjusts the meeple for the given job based on what arrow was clicked
     * @param {Event} event - onclick event
     */
    adjustJobMeeple(event){
        let ele = event.target;
        // This event can trigger on non-arrow elements since it is registered to the table's tbody
        if(!ele.classList.contains("plusmeeple") && !ele.classList.contains("minusmeeple")) return;

        let value;
        // Figure out whether this is a positive or negative value based on whether
        // it has plusmeeple (if it doesn't, then it has minusmeeple)
        if(ele.classList.contains("plusmeeple")) value = 1;
        else value = -1;
        // Figure out if this is a x10 arrow
        // If it is, multiply value x10
        if(ele.classList.contains("plustenmeeple") || ele.classList.contains("minustenmeeple")) value *= 10;

        // We need to figure out what job it is
        // We'll do that by searching up the tree for an element with an data-id value, as only the tr has that value
        // TODO: Consider adding job.id to the arrows so we don't have to do this
        while(typeof ele.parentElement.dataset == "undefined" || typeof ele.parentElement.dataset.id == "undefined" ){
            ele = ele.parentElement;
        }
        
        // Note that ele.parentElement is the element with job.id set, so we need to grab that instead of ele
        let job = ele.parentElement.dataset.id;
        
        // convert job id to job object
        job = this.game.getJobById(job);

        // Let The Colony handle the rest
        this.colony.assignJob(job, value);
    }
        
}

