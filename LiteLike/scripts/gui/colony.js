"use-strict";
import * as SITEGUI from "./site.js";
import { getStrings, makeTranslationLookup } from "../io.js";
import { MAXPOWER, sectors, TheColony } from "../colony.js";
import { enumerate, invertCost, generateElementPath} from "../utils.js";
import * as CHARACTER from "../character.js";
import { buildMessageSequence } from "../encounters.js";

/** DEVNOTE- this list needs to be maintained alongside the LANGUAGE jsons */
const STRINGS = enumerate(
    // Prefix to append to Exchange/Upgrade costs (i.e.- "[Cost]: 10 Scrap, 2 Batteries")
    "COST",
    // Home Pages
    // Starts on SECTORS because the first tab's name is dynamically generated
    "SECTORPAGE", "MEEPLEPAGE", "TRAVELPAGE",
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
    "JOBS","INCOME",

    // Travel Page
    // Travel Preparations
    // Transport Info
    "FUEL", "CAPACITY",
    // Transport Cargo
    "CARGO",
    // Mech Fieldset Legend
    "MECH",

    // Loadouts
    "WEAPONLOADOUT", "ITEMLOADOUT",

    // Travel Requirements
    "TRAVELREPAIR"
)

export class TheColonyGUI{
    /**
     * Initializes a new UI handler for TheColony
     * @param {TheColony} colony - The colony object that this UI is referencing
     */
    constructor(colony){
        this.colony = colony;

        this.translate = makeTranslationLookup(this.colony.game, STRINGS, "colony");

        this.pages = [];
        this.currentpage = null;

        this.tempListeners = {
            "shop": this.unlockShop.bind(this),
            "map": this.unlockMap.bind(this)
        }
        this.colony.addEventListener("powerlevelmodified", this.updatePowerLevel.bind(this));
        this.colony.addEventListener("resourcesmodified", this.updateStatusbox.bind(this));
        this.colony.addEventListener("unlockadded", this.tempListeners.shop);

        //These are bound in setupUI, but noted here for reference
        // statpanel.addEventListener("dragstart", this.dragInventory.bind(this))
        // statpanel.addEventListener("dragover", this.dragInventoryOver.bind(this));
        // statpanel.addEventListener("drop", this.dropInventory.bind(this));

        // These are bound in setupShop, but noted here for reference
        // this.colony.addEventListener("itemsmodified", this.updateStatusbox.bind(this));
        // this.colony.addEventListener("weaponsmodified", this.updateStatusbox.bind(this));
        // this.colony.addEventListener("resourcesmodified", this.updateShop.bind(this));

        this.colony.addEventListener("unlockadded", this.tempListeners.map);
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

        // This is bound in setupTravelPrep, but noted here for reference
        // travelPage.addEventListener("dragstart", this.dragInventory.bind(this));
        // travelPage.addEventListener("dragover", this.dragInventoryOver.bind(this));
        // travelPage.addEventListener("drop", this.dropInventory.bind(this));
        // this.game.PLAYER.addEventListener("equipmentchange", this.updateMapTransport.bind(this));
        // this.game.PLAYER.addEventListener("inventorychange", this.updateMapWeight.bind(this));
        // this.game.PLAYER.addEventListener("weaponadded", this.updatePlayerInventory.bind(this));
        // this.game.PLAYER.addEventListener("weaponremoved", this.updatePlayerInventory.bind(this));
        // this.game.PLAYER.addEventListener("itemadded", this.updatePlayerInventory.bind(this));
        // this.game.PLAYER.addEventListener("itemremoved", this.updatePlayerInventory.bind(this));
        // this.game.PLAYER.addEventListener("resourceschange", this.updatePlayerInventory.bind(this));
        // travelPage.querySelector("tbody.loadout.items").addEventListener("click", this.togglePlayerQuantity.bind(this));
        // travelPage.querySelector("fieldset[data-cargo]").addEventListener("click", this.togglePlayerQuantity.bind(this));
        // this.colony.addEventListener("itemsmodified", this.updateMechAvailability.bind(this));
        // this.colony.addEventListener("resourcesmodified", this.updateMechAvailability.bind(this));
    }

    get game() {return this.colony.game;}
    get statuspanel(){ return document.getElementById("statuspanel"); }
    get homepanel(){ return document.getElementById("home"); }
    get homenavbar(){ return document.getElementById("homenavbar"); }
    get homecontent(){ return document.getElementById("homecontent"); }

    /**
     * Creates a Button in Home's navigation bar with displayname as its text. When selected the button will show the page with id `${id}Page`.
     * @param {String} id - The id to apply to the Button
     * @param {String} displayname - The Button's text
     * @returns {Element} - The created button. This can be used to immediately activate the page via setPage
     */
    registerPage(id, displayname){
        // Add to navbar
        this.homenavbar.insertAdjacentHTML("beforeend", `<button id="${id}">${displayname}</button>`);
        let button = this.homenavbar.lastElementChild;
        // Hookup button to show page
        button.onclick = ()=>this.setPage(button);
        // Make sure page is hidden
        this.homecontent.querySelector(`#${id}Page`).style.height = "0px";
        return button;
    }
    /**
     * Callback for Home Page Buttons: swaps the currently displayed page to the selected one.
     * Register Page is used to setup this callback
     * Adapted from colonydemo
     * 
     * @param {Element} button - The button pressed
     */
    setPage(button){
        this.currentpage = button.id;
        let pageid = button.id+"Page";
        // Reenable all buttons
        for(let button of this.homenavbar.children) button.disabled = false;
        // Hide all pages
        for(let div of this.homecontent.children) div.style.height = "0px";
        // Disable Button
        button.disabled = true;
        // Show correct page
        document.getElementById(pageid).style.height = "100%";
    }

    /**
     * Populates the screen with the baseline UI Elements for TheColony
     */
    setupUI(){
        this.game.UI.gamewindow.insertAdjacentHTML("beforeend", `
<div id="colony">
    <div id="statuspanel"></div>
    <div id="home" style="width:100%;height:75vh;"><div id="homenavbar"></div><hr /><div id="homecontent"></div></div>
    <div id="gamemenu">
        <svg viewBox="0 0 20 15" preserveAspectRatio="none">
            <defs>
                <linearGradient id="grip" gradientTransform="rotate(90 0.5 0.5)" gradientUnits="objectBoundingBox">
                    <stop offset="0" stop-color="rgb(0, 10, 50)" />
                    <stop offset="0.5" stop-color="rgb(0, 40, 125)" />
                    <stop offset="1" stop-color="rgb(0, 75, 255)" />
                </linearGradient>
            </defs>

            <rect y="0" width="20" height="5" fill="url('#grip')"/>
            <rect y="5" width="20" height="5" fill="url('#grip')"/>
            <rect y="10" width="20" height="5" fill="url('#grip')"/>
        </svg>
        <div>
            <button id="savegame">${this.game.UI.translate(this.game.UI.STRINGS.SAVE)}</button>
            <button id="quitgame">${this.game.UI.translate(this.game.UI.STRINGS.QUIT)}</button>
        </div>
    </div>
</div>`);

        document.getElementById("quitgame").onclick = this.game.UI.exitToMainMenu.bind(this.game.UI);
        document.getElementById("savegame").onclick = this.game.UI.saveGame.bind(this.game.UI);
        let statpanel = this.statuspanel;
        // Create Resource Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="resourcesbox" class="statusbox"><div class="header">${this.game.UI.translate(this.game.UI.STRINGS.RESOURCES)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup resourcebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("resourcesbox"));
        // Setup draggable callback
        statpanel.addEventListener("dragstart", this.dragInventory.bind(this))
        statpanel.addEventListener("dragover", this.dragInventoryOver.bind(this));
        statpanel.addEventListener("drop", this.dropInventory.bind(this));

        let home = this.homecontent;
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
        let button = this.registerPage("admin","");
        this.setPage(button);

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
        if(!this.colony.checkUnlocks(["SECTORS"]).length){
            this.setupSectors();
            // Add existing sectors
            for(let sector of this.colony.sectors){
                // Spoofing the sectoradded event
                this.addSector({sector});
            }
        }
        // If The Colony has the Shop unlocked, set it up
        if(!this.colony.checkUnlocks(["SHOP"]).length) this.setupShop();
        // If The Colony has the Residential Sector unlocked, set it up
        if(this.colony.sectors.indexOf(sectors.RESIDENTIAL) >= 0) this.setupMeeple();
        // If The Colony has the Map unlocked, set it up
        if(!this.colony.checkUnlocks(["MAP"]).length) this.setupTravelPrep();
    }

    /**
     * Sets up the Sectors Tab on the Colony GUI
     */
    setupSectors(){
        // Setup and register Sectors page
        let home = this.homecontent;
        home.insertAdjacentHTML('beforeend', `<div id="sectorsPage"><table><tbody id="sectortable"></tbody></table></div>`);
        this.registerPage("sectors", this.translate(STRINGS.SECTORPAGE));
    }

    /**
     * 
     * @param {TheColonyEvent} event - The Colony's unlockadded event
     */
    unlockShop(event){
        // The Colony now has the SHOP unlock
        if(!this.colony.checkUnlocks(["SHOP"]).length) this.setupShop();
    }

    /**
     * Sets up the Shop (Trader) section on the Admin Page
     */
    setupShop(){
        // Make sure to remove the listener because we already have it
        this.colony.removeEventListener("unlockadded", this.tempListeners.shop);

        // Add Items and Weapons to the sidebar
        let statpanel = this.statuspanel;
        // Create Items Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="itemsbox" class="statusbox"><div class="header">${this.game.UI.translate(this.game.UI.STRINGS.ITEMS)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup itembox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("itemsbox"));
        // Create Weapons Panel
        statpanel.insertAdjacentHTML('beforeend', `<div id="weaponsbox" class="statusbox"><div class="header">${this.game.UI.translate(this.game.UI.STRINGS.WEAPONS)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><table class="boldfirst quantitytable"><tbody></tbody></table></div></div>`)
        // Setup weaponbox hide/show
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

    /**
     * Adds Resident Count to the Admin Page and sets up the Population Tab
     */
    setupMeeple(){
        // Add resident count to admin page
        document.querySelector("#adminTopBar").insertAdjacentHTML('beforeend',`<div style="font-weight:bold;">
        ${this.translate(STRINGS.RESIDENTS)}: <span id="population"></span>
    </div>`);

        let home = this.homecontent;
        home.insertAdjacentHTML('beforeend', `<div id="meeplePage"><fieldset><legend>${this.translate(STRINGS.JOBS)}</legend><table><tbody id="jobtable"></tbody></table></fieldset><fieldset><legend>${this.translate(STRINGS.INCOME)}</legend><table><tbody id="incometable"></tbody></table></fieldset></div>`);
        this.registerPage("meeple", this.translate(STRINGS.MEEPLEPAGE));

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
        this.updateMeeple({newmeeple:this.colony.meeples});
    }

    /**
     * 
     * @param {TheColonyEvent} event - The Colony's unlockadded event
     */
    unlockMap(event){
        // The Colony now has the MAP unlock
        if(!this.colony.checkUnlocks(["MAP"]).length) this.setupTravelPrep();
    }

    /**
     * Sets up the Travel Preparation Tab
     * DEVNOTE- The map is a popup which is created by interacting with the
     *      Travel Prep Tab, so the Travel Prep Tab will always be in the background
     *      while traveling the Overworld
     */
    setupTravelPrep(){
        // Make sure to remover EventListener
        this.colony.removeEventListener("unlockadded", this.tempListeners.map);
        let home = this.homecontent;
        let transport = this.game.PLAYER.transport;
        let transportstrings = getStrings(this.game.STRINGS, transport);
        home.insertAdjacentHTML('beforeend', `<div id="travelPage">
        <button id="depart">Depart</button>
<fieldset id="transport"><legend title="${transportstrings.flavor}">${transportstrings.name}</legend>
<div><b>${this.translate(STRINGS.FUEL)}</b>:&nbsp;<span data-fuel>${transport.maxReactorPower}</span></div>
<div><b>${this.translate(STRINGS.CAPACITY)}</b>:&nbsp;<span data-carry>${this.game.PLAYER.weight}</span>/<span data-capacity>${transport.capacity}</span></div>
<fieldset data-cargo>
    <legend>${this.translate(STRINGS.CARGO)}</legend>
    <fieldset data-weapons><legend>${this.game.UI.translate(this.game.UI.STRINGS.WEAPONS)}</legend><div></div></fieldset>
    <fieldset data-items><legend>${this.game.UI.translate(this.game.UI.STRINGS.ITEMS)}</legend><div></div></fieldset>
    <fieldset data-resources><legend>${this.game.UI.translate(this.game.UI.STRINGS.RESOURCES)}</legend><div></div></fieldset>
</fieldset>
</fieldset>
<fieldset id="loadout"><legend>${this.translate(STRINGS.MECH)}</legend>
    <h3>${this.translate(STRINGS.WEAPONLOADOUT)}</h3>
    <table><tbody class="loadout weapons">
        <tr><td class="loadout" data-slot="0" draggable="true"></td><td></td><td class="loadout" data-slot="1" draggable="true"></td></tr>
        <tr><td></td><td class="loadout" data-slot="2" draggable="true"></td><td></td></tr>
        <tr><td class="loadout" data-slot="3" draggable="true"></td><td></td><td class="loadout" data-slot="4" draggable="true"></td></tr>
    </tbody></table>
    <h3>${this.translate(STRINGS.ITEMLOADOUT)}</h3>
    <table><tbody class="loadout items">
        <tr><td class="loadout" data-slot="0" draggable="true"></td><td class="loadout" data-slot="1" draggable="true"></td><td class="loadout" data-slot="2" draggable="true"></td></tr>
    </tbody></table>
</fieldset>
</div>`);
        this.registerPage("travel", this.translate(STRINGS.TRAVELPAGE));

        // Checks that the player has Repairbots and then shows the Map
        document.getElementById("depart").onclick = this.checkShowMap.bind(this);

        // The Travel Preparations section is populated by a combination of drag-and-drop and arrows
        // Since the drag and drop functionality can be used in multiple places, travelPage is bound in general
        let travelPage = document.getElementById("travelPage");
        travelPage.addEventListener("dragstart", this.dragInventory.bind(this));
        travelPage.addEventListener("dragover", this.dragInventoryOver.bind(this));
        travelPage.addEventListener("drop", this.dropInventory.bind(this));
        
        // Make sure to update transport title when the Player's transport changes 
        this.game.PLAYER.addEventListener("equipmentchange", this.updateMapTransport.bind(this));
        // Update carry weight when the stuff the Player is carrying changes
        this.game.PLAYER.addEventListener("inventorychange", this.updateMapWeight.bind(this));
        // Update loadout and inventory when that changes
        this.game.PLAYER.addEventListener("weaponadded", this.updatePlayerInventory.bind(this));
        this.game.PLAYER.addEventListener("weaponremoved", this.updatePlayerInventory.bind(this));
        this.game.PLAYER.addEventListener("itemadded", this.updatePlayerInventory.bind(this));
        this.game.PLAYER.addEventListener("itemremoved", this.updatePlayerInventory.bind(this));
        this.game.PLAYER.addEventListener("resourceschange", this.updateMechResources.bind(this));

        // Toggles for manipulating inventory quantities
        travelPage.querySelector("tbody.loadout.items").addEventListener("click", this.togglePlayerQuantity.bind(this));
        travelPage.querySelector("fieldset[data-cargo]").addEventListener("click", this.togglePlayerQuantity.bind(this));

        // Update toggle arrows when colony inventory changes
        this.colony.addEventListener("itemsmodified", this.updateMechAvailability.bind(this));
        this.colony.addEventListener("resourcesmodified", this.updateMechAvailability.bind(this));
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

                tbody.insertAdjacentHTML(`beforeend`, `<tr data-id="${id}" draggable="true"><td title="${info.flavor}">${info.name}</td><td data-qty></td></tr>`);
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
            let toggle = `<td><table class="incrementer"><tbody>
            <tr><td class="plus"></td><td class="plus plustenmeeple"></td></tr>
            <tr><td class="minus disabled"></td><td class="minus minustenmeeple disabled"></td></tr>
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

        // Make sure arrows are up-to-date
        this.updateFreeMeeple();
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
            jobrow.querySelectorAll("td.minus").forEach((ele)=>ele.classList.add("disabled"));
        }else{
            jobrow.querySelectorAll("td.minus").forEach((ele)=>ele.classList.remove("disabled"));
        }

        // List of Incomes that will need to have their totals updated
        let updateincometotals = [];

        // Update income breakdowns
        // Required needs to be inverted as it is subtracting from the income
        for(let [resource, rqty] of [
            ... job.resourcesGenerated,
            ... invertCost(job.resourcesRequired)
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
            ratespan.innerText = newRate >= 0 ? "+"+newRate : newRate;
            
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
            rate = rate >= 0 ? "+"+rate : rate;
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
        
        // No free meeple, so disable all all plus arrows
        if(!freemeeple){
            jobtable.querySelectorAll("td.plus").forEach((ele)=>ele.classList.add("disabled"));
        }else{
            // Otherwise, we can atleast increment by 1
            jobtable.querySelectorAll("td.plus").forEach((ele)=>ele.classList.remove("disabled"));
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

        // Sector has no levels
        if(!sector.level){
            // Disable it
            td.querySelector("div.progressbar").classList.add("disabled");
        }
        // If the sector timer is ready and is frozen, call the changecallback now
        else if(sector.timer.isReady && sector.timer.isFrozen){
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
            // Make sure transition is linear (defaults to ease-out)
            progressbar.style.transitionTimingFunction = "linear";
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
        else{
            // Add the warmup class to show that it's cycling normally
            td.querySelector("div.progressbar").classList.add("warmup");
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
        if(!ele.classList.contains("plus") && !ele.classList.contains("minus")) return;

        let value;
        // Figure out whether this is a positive or negative value based on whether
        // it has plus (if it doesn't, then it has minusmeeple)
        if(ele.classList.contains("plus")) value = 1;
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
        
    /**
     * 
     * @param {Event} event the dragstart event
     */
    dragInventory(event){
        // We haven't unlocked the Map yet, so don't drag anything
        if(this.colony.checkUnlocks(["MAP"]).length) return event.preventDefault();

        // Make sure dataTransfer is empty
        event.dataTransfer.clearData();

        // Establish what the source is because that dictates what the droppable area is
        // DEVNOTE- We're using the queryselector strings because moz is the only browser
        //      type that supports storing nodes (x-moz-node)
        let loadoutweapons= "#loadout tbody.loadout.weapons";
        let loadoutitems= "#loadout tbody.loadout.items";
        let transport = "#transport";
        let statusweapons = "#weaponsbox";
        let statusitems = "#itemsbox";
        let statusresources = "#resourcesbox";

        let src;
        let path = generateElementPath(event.target);
        for(let source of [loadoutweapons, loadoutitems, transport, statusweapons, statusitems, statusresources]){
            // The dragged object is a child of the src
            if(path.indexOf(document.querySelector(source))>=0){
                // Store the source for future reference both locally and on the eventdata
                src = source;
                // DEVNOTE- This is, technically, an abuse of setData as all data in
                //      dataTransfer should be synonomous with each other but this is
                //      the simplest way to keep a reference for source and lets us
                //      avoid setting up multiple drag callbacks
                event.dataTransfer.setData("text/node",src);
                break;
            }
        }
        // We could not actually establish an origin
        if(!src) return;
        // We can only drag the toplevel spans from transport (to keep things from being confusing)
        if(src == transport && (!event.target.dataset.type || typeof event.target.dataset.type == "undefined")){
            // Stop us from dragging if the target is not a valid span (has type)
            event.dataTransfer.clearData();
            return event.preventDefault();
        }

        // Determine item type and index
        // DEVNOTE- Type is relevant for two reasons: 1) the Transport can hold any item types, so we have
        //      to establish what the item is now; and 2) we're not simply saving the item to event data.
        //      If the Transport could only hold one type of item, then we only need to know the source.
        //      If we saved the item data, then we could figure out what type it is by inspecting the item.
        //      Index is relevant because of rearranging the weapons loadout
        let type, id, index =-1, qty = 1;
        switch(src){
            case loadoutweapons:
                type="weapon";
                index = parseInt(event.target.dataset.slot);
                id = this.game.PLAYER.weapons[index].type.id;
                break;
            case loadoutitems:
                type="item";
                index=parseInt(event.target.dataset.slot);
                id = this.game.PLAYER.items[index].type.id;
                qty = this.game.PLAYER.items[index].quantity;
                break;
            case statusweapons:
                id= parseInt(event.target.dataset.id);
                type="weapon";
                qty = Math.min(this.colony.getWeapon(id), 1)
                break;
            case statusitems:
                id = parseInt(event.target.dataset.id);
                type="item";
                qty = Math.min(this.colony.getItem(id), 1);
                break;
            case statusresources:
                id = parseInt(event.target.dataset.id);
                type="resource";
                qty = Math.min(this.colony.getResource(id), 1);
                break;
            case transport:
                id = parseInt(event.target.dataset.id);
                type = event.target.dataset.type;
                index = event.target.dataset.index
                // Weapons are singletons (qty always is 1)
                if(type == "weapon") qty = 1;
                // Othwerise get qty from player
                else if(type == "item") qty = this.game.PLAYER.getItem(id).quantity;
                else if(type == "resource") qty = this.game.PLAYER.resources[id];
        }


        // We don't actually have a qty to move
        if(!qty){
            // Notify Player
            SITEGUI.flashText(event.target);
            // Stop Drag
            return event.preventDefault();
        }

        // Save info we need for the item (type and ID)
        /**
         *  DEVNOTE- The Dragover Callback wants to know the type, but cannot see values associated to types
         *      therefore we are saving the type as part of the dataType (available to Dragover via dataTransfer.types)
         */
        event.dataTransfer.setData(`text/obj`, `${type}/${id}/${index}/${qty}`);
    }

    /**
     * Callback for the dragover event
     * @param {Event} event - the dragover event
     */
    dragInventoryOver(event){
        // We use dropping in "illegal" areas as a way to remove the item completely
        // therefore always allow the user to drop
        event.preventDefault();
    }

    /**
     * Drops an inventory item in the give location
     * @param {Event} event - the drop event
     */
    dropInventory(event){
        // These are the valid areas where inventory can be dropped
        let loadoutweapons= "#loadout tbody.loadout.weapons";
        let loadoutitems= "#loadout tbody.loadout.items";
        let transport = "#transport";
        // The above as well as the following elements are sources
        let statusweapons = "#weaponsbox";
        let statusitems = "#itemsbox";
        let statusresources = "#resourcesbox";

        let src = event.dataTransfer.getData("text/node");

        let idindexqty = event.dataTransfer.getData(`text/obj`);
        let [type, id,index,qty] = idindexqty.split("/");
        id = parseInt(id), index = parseInt(index), qty = parseInt(qty);

        let player = this.game.PLAYER
        let item;

        // Note: We know we can drop where we're pointing right now because the dragOver event would prevent
        //      us from dropping in the first place

        // Since we're dropping it, remove the item from its source
        // Trigger any appropriate callbacks to update the UI
        // For Colony sources, create the item Instance
        if(src == statusweapons){
            // The weapon may have dropped while we were dragging
            // If it did, don't do anything
            if(this.colony.weapons[id] <=0) return;
            // Otherwise, take 1x weapon from TheColony
            this.colony.weapons[id]-=1;
            this.colony.triggerEvent(TheColony.EVENTTYPES.weaponsmodified, {weaponchange: [[id, -1]]});
            item = this.game.createEquipmentInstance("Weapon",id);
        }else if(src == statusitems){
            // The item may have dropped while we were dragging
            // If it did, don't do anything
            if(this.colony.items[id] <=0) return;
            // Otherwise, take 1x item from TheColony
            this.colony.items[id]-=1;
            this.colony.triggerEvent(TheColony.EVENTTYPES.itemsmodified, {itemchange: [[id, -1]]});
            // Defaults to qty 1
            item = this.game.createEquipmentInstance("Item",id);
        }else if(src == statusresources){
            // The resource may have dropped while we were dragging
            // If it did, don't do anything
            if(this.colony.resources[id] <=0) return;
            // Otherwise, take 1x resource from TheColony
            this.colony.resources[id] -=1;
            this.colony.triggerEvent(TheColony.EVENTTYPES.resourcesmodified, {resourcechange: [[id, -1]]});
            // Defaults to qty 1
            item = this.game.createEquipmentInstance("Resource",id);
        }
        else if(type=="weapon"){
            item = player.removeWeapon(index);
            player.triggerEvent("weaponremoved", {item, index});
        }
        else if(type == "item"){
            let previousIndex;
            [item, previousIndex] = player.removeItem(index);
            player.triggerEvent("itemremoved", {item, index: previousIndex});
        }
        // Resource
        else{
            qty = player.getResource(id, true).quantity;
            player.resources[id] = null;
            // player.resources is a {id: qty} mapping, so convert what we have to a Resource Instance
            item = this.game.createEquipmentInstance("Resource", id, qty);
            player.triggerEvent("resourceschange", {resources:{[id]: -qty}});
        }


        let path = generateElementPath(event.target);
        // We're keeping track of dropped, because if an item wasn't dropped it needs to be put
        // into The Colony
        let dropped = false;

        // Item is being dropped in the weapons loadout and is a weapon
        // (therefore this is a valid drop location)
        if(path.indexOf(document.querySelector(loadoutweapons)) >= 0 && type == "weapon"){
            let index = null;
            // We need to determine the target slot, which is only available on the td
            // (which have to find)
            let ele = event.target
            // We're going to set the table as our stop point to be safe`
            while(ele.tagName !== "TABLE"){
                if(typeof ele.dataset.slot !== "undefined"){
                    index = parseInt(ele.dataset.slot);
                    break;
                }
                ele = ele.parentElement;
            }
            // If we haven't found the slot, the default is the first (0) index
            // NOTE- this means any weapon dropped inside the loadout but not inside
            //      a loadout table cell will automatically become the first weapon
            if(index == null) index = 0;
            
            // Adding a weapon to an occupied loadout slot will shift the array
            // so we need to check if the array shifted afterwards
            let initial = [...player.weapons];
            // Add item to that index
            player.addWeapon(item, index);
            // We'll compare each index up until the first non-loadout weapon and trigger a change
            // for each different one (at most only one weapon will be pushed into index > weapons.loadout)
            for(let index = 0; index < player.weapons.loadout+1; index++){
                let item = player.weapons[index];
                if(item && typeof item !== "undefined" && initial[index]!=item){
                    player.triggerEvent("weaponadded", {item, index});
                }
                
            }
            

            dropped = true;
        }

        // Item is being dropped in the items loadout and is an item
        // (therefore this is a valid drop location)
        else if(path.indexOf(document.querySelector(loadoutitems)) >= 0 && type == "item"){
            let index = null;
            // We need to determine the target slot, which is only available on the td
            // (which have to find)
            let ele = event.target
            // We're going to set the table as our stop point to be safe`
            while(ele.tagName !== "TABLE"){
                if(typeof ele.dataset.slot !== "undefined"){
                    index = parseInt(ele.dataset.slot);
                    break;
                }
                ele = ele.parentElement;
            }
            // If we haven't found the slot, the default is the first (0) index
            // NOTE- this means any item dropped inside the loadout but not inside
            //      a loadout table cell will automatically become the first item
            if(index == null) index = 0;

            // Adding a item to an occupied loadout slot will shift the array
            // so we need to check if the array shifted afterwards
            let initial = [...player.items];
            let [newItem, existingIndex] = player.addItem(item, index);
            // We'll compare each index up until the first non-loadout item and trigger a change
            // for each different one (at most only one item will be pushed into index > items.loadout)
            for(let index = 0; index < player.items.loadout+1; index++){
                let item = player.items[index];
                // An item or different item was added to this slot
                if(item && typeof item !== "undefined" && initial[index]!=item){
                    player.triggerEvent("itemadded", {item, index});
                // An item was removed from this slot
                }else if((!item || typeof item == "undefined") && initial[index] && typeof initial[index] !== "undefined"){
                    // Provide the removed item as the item
                    player.triggerEvent("itemremoved", {item:initial[index], index});
                }
            }
            
            // The Player already had the item, so we need to update the
            // UI to show that it was combined with this item
            if(existingIndex){
                player.triggerEvent("itemremoved", {item:newItem, index: existingIndex});
            }

            dropped = true;
        }

        // Item is being dropped in the Transport
        else if(path.indexOf(document.querySelector(transport))>= 0){
            // Figure out how to add it
            if(type == "weapon"){
                player.addWeapon(item);
                // addWeapon without an index simply pushes, so the weapon's index is length-1
                player.triggerEvent("weaponadded", {item, index: player.weapons.length -1});

                dropped = true;
            }
            else if(type == "item"){
                index = player.items.length;
                // addItem will add the item's qty to any existing
                // instance of the same ItemType and return that instance
                // If the item already existed, it will return the existing index             
                let previousIndex = null;
                [item, previousIndex] = player.addItem(item, index);
                if(previousIndex !== null){
                    // The Player already had the item, so we need to update the
                    // UI to show that it was combined with this item
                    player.triggerEvent("itemremoved", {item, index:previousIndex});
                }
                // Update index to match the current position of the Item
                index = player.getItemIndex(item.type.id);
                player.triggerEvent("itemadded", {item, index});

                dropped = true;
            }
            // Resource
            else{
                player.addResource(item);
                player.triggerEvent("resourceschange", {resources:{[item.type.id]: item.quantity}});

                dropped = true;
            }
        }

        // Inventory that was not dropped successfully is returned to The Colony
        if(!dropped){
            if(type == "weapon"){
                // NOTE- qty should always be 1 here
                this.colony.addWeapon(id, qty)
                this.colony.triggerEvent("weaponsmodified", {weaponchange: [[id, qty]]});
            }else if(type == "item"){
                this.colony.addItem(id, qty);
                this.colony.triggerEvent("itemsmodified", {itemchange: [[id, qty]]});
            }else if(type == "resource"){
                this.colony.addResource(id, qty);
                this.colony.triggerEvent("resourcesmodified", {resourcechange: [[id, qty]]});
            }
        }

        // Finally,  update weight (Spoofing an event)
        this.updateMapWeight({eventtype:CHARACTER.Character.EVENTTYPES.inventorychange});
    }

    /**
     * Update the Travel Preparations Transport fieldset
     * @param {CharacterEvent} event - The Character.equipmentchange event
     */
    updateMapTransport(event){
        // Only listen for the "transport" subtype
        if(event.subtype !== "transport") return;
        let transport = this.game.PLAYER.transport;
        let transportstrings = getStrings(this.game.STRINGS, transport);
        document.querySelector("#transport>legend").innerText = transportstrings.name;
        document.querySelector("#transport>legend").setAttribute("title", transportstrings.flavor);
        document.querySelector("#transport span[data-fuel]").innerText = transport.maxReactorPower;
        document.querySelector("#transport span[data-capacity]").innerText = transport.capacity;
    }

    /**
     * Updates the Player's carry weight whenever its equipment changes
     * @param {CharacterEvent} event - The Character.inventorychange event
     */
    updateMapWeight(event){
        document.querySelector("#transport span[data-carry]").innerText = this.game.PLAYER.weight;
    }

    /**
     * Updates the Mech's Loadout and/or Transports inventory based on what changed
     * @param {CharacterEvent} event - One of: weaponadded, weaponremoved, itemadded, itemremoved
     */
    updatePlayerInventory(event){
        let player = this.game.PLAYER;
        let type, loadout;
        // Delegate as necessary
        if(event.eventtype.description == "weaponadded" || event.eventtype.description == "weaponremoved") type = "weapon", loadout = player.weapons.loadout;
        if(event.eventtype.description == "itemadded" || event.eventtype.description == "itemremoved") type = "item", loadout = player.items.loadout;
        // If it's part of the loadout, update loadout
        if(event.index < loadout) this.updateLoadout(type, event.index);
        // Otherwise, update transport
        else this.reloadTransportType(type);
        // If the weapon has ammo, make sure the ammo is available in the Transport Resources
        if(type == "weapon" && event.item.type.ammunition){
            // We'll spoof an event to call the update function
            // NOTE- We need to include a change amount, since updateMechResources skips the resource
            // if the change is 0: uMR ignores our fake change amount and reference the Player
            // instead to find the quantity to display
            this.updateMechResources({resources:{[event.item.type.ammunition]: 1}});
        }
    }

    /**
     * Adds a quantity span and Toggle Arrows to an element. This function does not
     *      add any callbacks to the element.
     * @param {HTMLElement} element - A DOM Element to add the quantity elements to
     * @param {Object} item - An Object (Item or Resource) to get the quantity from
     * @param {Number} item.quantity - The Object should have a numeric quantity to display
     * @param {Boolean} availability - Whether or not to enable the Plus arrow
     */
    addQuantity(element, item, availability){
        element.insertAdjacentHTML('beforeend',`: <span data-qty>${item.quantity}</span><table class="incrementer inline"><tbody>
            <tr><td class="plus"></td>
            <td class="minus"></td></tr>
        </tbody></table>`);
        // Disable minus if the object doesn't have a quantity
        // NOTE- this should only happen when Weapon Ammo is automatically added
        if(!item.quantity){
            element.lastElementChild.querySelector("td.minus").classList.add("disabled");
        }
        if(!availability) element.lastElementChild.querySelector("td.plus").classList.add("disabled");
    }
    
    /**
     * Updates the index's UI slot for the given loadout
     * @param {"weapon" | "item"} type- The Equipment Type
     * @param {Number} index - The Index to update
     */
    updateLoadout(type,index){
        let slot = document.querySelector(`#loadout tbody.loadout.${type}s td[data-slot="${index}"]`);
        if(!slot) return;
        // We're overwriting the slot, so clear it out
        while(slot.lastElementChild) slot.lastElementChild.remove();

        let equipment = this.game.PLAYER[type+"s"][index];

        // Slot is empty on the Player
        if(!equipment || typeof equipment == "undefined") return;

        let strings = getStrings(this.game.STRINGS, equipment);
        slot.insertAdjacentHTML('beforeend', `<span data-id="${equipment.type.id}" data-type="${type}" title="${strings.flavor}">${strings.name}</span>`);
        // If it's an item, add the quantity and toggle buttons to it
        // The last arguement is availability and sets the plus arrow based on whether TheColony has any more qty
        if(type == "item") this.addQuantity(slot.lastElementChild, equipment, Boolean(this.colony.getItem(equipment.type.id)));
        this.updateMapWeight();
    }

    /**
     * Reloads the given bucket
     * DEVNOTE- Because Equipment Arrays (Weapons, Items) shift indices as entries are removed (and potentially added)
     *      it is easier to simply start from scratch whenever an new Instance is added.
     * @param {String} type- The invenotry type to reload ("weapon", "item", "resource")
     */
    reloadTransportType(type){
        let bucket = document.querySelector(`#transport fieldset[data-${type}s]`);
        // Clear out the UI for the type
        while(bucket.lastElementChild){
            // Stop at legend
            if(bucket.lastElementChild.tagName == "LEGEND") break;
            bucket.lastElementChild.remove();
        }
        // We need to keep track of index specifically for weapons
        // To keep our code uniform, we'll just do the same thing for all three types
        let items, index;
        // Transport only shows Weapons and Items that are not in loadout
        if(type == "weapon"){
            items = this.game.PLAYER.weapons.getAdditional();
            // Loadout is a count and we start the below loop by incrementing
            // so offset the count by 1 so when we increment we get the next index
            index = this.game.PLAYER.weapons.loadout -1;
        }
        else if(type == "item"){
            items = this.game.PLAYER.items.getAdditional();
            // Loadout is a count and we start the below loop by incrementing
            // so offset the count by 1 so when we increment we get the next index
            index = this.game.PLAYER.items.loadout -1;
        }

        for(let item of items){
            index+=1
            // Empty slot, skip (NOTE- should only happen for Resources)
            if(!item || typeof item == "undefined") continue;
            let strings = getStrings(this.game.STRINGS, item);
            let insertHTML = `<span class="cargo" data-type="${type}" data-id="${item.type.id}" data-index="${index}" title="${strings.flavor}" draggable="true">${strings.name}${typeof item.qty !== "undefined" ? `<span data-qty>${qty}</span>`: ``}</span>`;
            bucket.insertAdjacentHTML('beforeend', insertHTML);
            // If it's an item, add the quantity and toggle buttons to it
            // The last arguement is availability and sets the plus arrow based on whether TheColony has any more qty
            if(type == "item") this.addQuantity(bucket.lastElementChild, item, Boolean(this.colony.getItem(item.type.id)));
        }
        this.updateMapWeight();
    }

    /**
     * When resources are changed on the Player, update the resources displayed in the transport
     * @param {CharacterEvent} event - The Character.resourceschange event
     */
    updateMechResources(event){
        let player = this.game.PLAYER
        let cargo = document.querySelector("#transport fieldset[data-resources]");
        for(let [resource,qty] of Object.entries(event.resources)){
            // Resource didn't actually change (shouldn't actually happen)
            if(!qty) continue;
            // Like in other places, we'll reference The Player's current total instead
            qty = player.getResource(resource, true).quantity;
            if(!qty){
                let isWeaponAmmo = false;
                // Check if this resource is weapon ammo
                for(let weapon of player.weapons){
                    // Weapon slot may be empty if its in the loadout
                    if(!weapon || typeof weapon == "undefined") continue;
                    if(weapon.weapontype.ammunition == resource){
                        // We only need to find one right now
                        isWeaponAmmo = true;
                        break;
                    }
                }
                // If the resource is not weapon ammo, remove it from the UI
                // (weapon ammo is added to the cargo even if it's qty 0)
                if(!isWeaponAmmo){
                    let ele = cargo.querySelector(`span.cargo[data-type="resource"][data-id="${resource}"]`);
                    ele.remove();
                    // Since the ele is removed, we can move on to the next resource
                    continue;
                }
            }
            // qty may be null, so coerce it into 0
            // NOTE- this should only happen for Weapon Ammo
            if(!qty) qty = 0;
            
            // Otherwise add resource if necessary and update qty
            // We only really need the qty span, so we'll fetch it specifically
            let parent = cargo.querySelector(`span.cargo[data-type="resource"][data-id="${resource}"]`)

            // No such span, so we (presumably) we need to add the full .cargo span
            if(!parent || typeof parent == "undefined"){
                // The resource from resourcechange is ID only
                // Need readable strings to display, which in turn requires an object to generate them
                let obj = this.game.ITEMS.resources[resource];
                let strings = getStrings(this.game.STRINGS, obj);

                // Resources should be kept in ID order, so determine which element
                // this resource should be put infront of
                let nextEle = null;
                for(let sibling of cargo.children){
                    // We've found the element we're supposed to go infront of, so we're done
                    if(parseInt(sibling.dataset.id) > resource){
                        nextEle = sibling;
                        break;
                    }
                }
                let insertHTML = `<span class="cargo" data-type="resource" data-id="${resource}" title="${strings.flavor}" draggable="true"> ${strings.name}</span>`;
                // This resource goes at the end
                if(!nextEle) cargo.insertAdjacentHTML('beforeend', insertHTML);
                else nextEle.insertAdjacentHTML('beforebegin', insertHTML);

                // Our inserted ele
                let ele = cargo.querySelector(`span.cargo[data-id="${resource}"]`)

                // Add Quantity and Toggle arrows to it
                let colonyqty = this.colony.getResource(resource);
                this.addQuantity(ele, {quantity: qty}, Boolean(colonyqty));

                // Newly created ele is up to date, so move on to next resource
                continue;
            }

            // Otherwise, we can update the qty
            parent.querySelector(`span[data-qty]`).innerText = qty;
            // Update minus Arrow
            if(!qty){
                parent.querySelector("td.minus").classList.add("disabled");
            }else{
                parent.querySelector("td.minus").classList.remove("disabled");
            }
        }

        // Finally,  update weight (Spoofing an event)
        this.updateMapWeight({eventtype:CHARACTER.Character.EVENTTYPES.inventorychange});
    }

    /**
     * Updates Item/Resource Plus/Minus arrows based on resource availability on TheColony
     * @param {TheColonyEvent} event - The resourcesmodified or itemsmodified event of TheColony
     */
    updateMechAvailability(event){
        let type, callback;
        if(event.eventtype.description == "resourcesmodified"){
            type="resource";
            callback = this.colony.getResource.bind(this.colony);
        }
        else if(event.eventtype.description == "itemsmodified"){
            type="item"
            callback = this.colony.getItem.bind(this.colony);
        }

        // As always, this should not happen and if it did
        // we should really raise an Error instead
        if(typeof type == "undefined") return;

        let travelPage = document.getElementById("travelPage");

        for(let [id, _] of event[`${type}change`]){
            // Get the actual quantity on TheColony
            let qty = callback(id);

            if(qty<=0){
                // If TheColony does not have any, disable PLus Arrows
                travelPage.querySelectorAll(`[data-type=${type}][data-id="${id}"] table.incrementer .plus`).forEach(ele=>ele.classList.add("disabled"));
            }else{
                // If TheColony does have the object, make sure all Plus Arrows are enabled
                travelPage.querySelectorAll(`[data-type=${type}][data-id="${id}"] table.incrementer .plus`).forEach(ele=>ele.classList.remove("disabled"));
            }
        }
    }

    /**
     * If an arrow is clicked on travelPage, toggles that resource +-
     * @param {Event} event - The onclick event
     */
    togglePlayerQuantity(event){
        let ele = event.target;
        let plus = ele.classList.contains("plus"), minus = ele.classList.contains("minus");
        // We bind to everything, so make sure this callback is for an arrow
        if(!plus && !minus) return;
        // Do nothing if arrow is disabled
        if(ele.classList.contains("disabled")) return;
        
        // Plus arrow increases amount, minus arrow decreases
        let mod = plus ? +1: -1;

        // Since we're targeting only the arrows we need to
        // navigate up the tree to find what we're modifying
        let topEle = null;
        while(!topEle){
            ele = ele.parentElement;
            if(ele.dataset.type && typeof ele.dataset.type !== "undefined") topEle = ele;
        }

        let id = ele.dataset.id, type = ele.dataset.type;
        let player = this.game.PLAYER;


        // Make sure that the place we're taking from actually has
        // quantity that we can take
        let available = false;

        // If we're adding to Player, we're taking from Colony
        if(mod > 0){
            if(type == "resource") available = this.colony.getResource(id) > 0;
            else if (type == "item")  available = this.colony.getItem(id) > 0;
        }
        // Otherwise, we're taking from the Player
        else{
            if(type == "resource") available = Boolean(player.getResource(id));
            else if(type == "item") available = Boolean(player.getItem(id));
        }

        // If we can't perform the action, do nothing
        if(!available) return;

        if(type == "resource"){
            if(mod > 0){
                this.colony.resources[id] -=1;
                // Player.addResource requires an instance (which Colony does not have)
                let obj = this.game.createEquipmentInstance("Resource", id, 1);
                player.addResource(obj);
                
            }else {
                player.resources[id] -= 1;
                this.colony.resources[id]+=1;
            }
            // Our mod is relative to the player, so colony is the opposite of mod
            this.colony.triggerEvent("resourcesmodified", {resourcechange: [[id, mod*-1]]});
            player.triggerEvent("resourceschange", {resources: {[id]: mod}});
        }else if(type == "item"){
            let previousIndex;
            if(mod > 0){
                this.colony.items[id] -=1;
                // Player.addItem requires an instance of the item
                let obj = this.game.createEquipmentInstance("Item", id, mod);
                [obj, previousIndex] = player.addItem(obj);

                player.triggerEvent("itemadded", {item: obj, index: previousIndex});
            }else {
                // removeItem requires the exact Item Instance, so we need to get it
                let obj = player.getItem(id);
                // Remove a positive quantity only
                // Update obj to match the removedItem
                [obj, previousIndex] = player.removeItem(undefined, obj, Math.abs(mod));
                this.colony.items[id]+=1;

                player.triggerEvent("itemremoved", {item: obj, index: previousIndex});
            }
            // Our mod is relative to the player, so colony is the opposite of mod
            this.colony.triggerEvent("itemsmodified", {itemchange: [[id, mod*-1]]});
        }
    }
    
    /**
     * Checks that the Player has Repairbots (so that it can actually travel the map)
     * and then displays the Map
     */
    checkShowMap(){
        // Repair Bots are ID 0
        let repairbots = this.game.PLAYER.getItem(0, true);

        // Require the Player to have Repair Bots in order to Travel
        if(!repairbots.quantity){
            // Get localized Repair Bot and Transport Names
            let repairbotstring = getStrings(this.game.STRINGS, repairbots);
            let transportstrings = getStrings(this.game.STRINGS, this.game.PLAYER.transport);
            // Display a Message Sequence (only 1 Message encounter in sequence) telling the
            // Player that they require Repair Bots to travel; using an Encounter as it's
            // more obvious than the MessageBox
            let sequence = buildMessageSequence(this.game, [
                // Get localized string fro Travelrepair, and use localized name for repairbot
                // DEVNOTE - While we're probably not going to change the name of Repair Bots,
                //      it's still safer to substitute it in instead of hardcoding it in TRAVELREPAIR
                this.translate(STRINGS.TRAVELREPAIR, {repairbot: repairbotstring.name, transport: transportstrings.name})
            ]);

            // Add Encounter Sequence (in case we happened to hit the travel button at the same
            // time that a Random Encounter occurred) and return since we're not showing map
            return this.game.getOrAddEncounter(sequence);
        }

        // Otherwise, we can show map so the player can travel
        this.game.MAP.ui.showMap()
    }
}

