import * as MAP from "../map.js";
import * as ENCOUNTERS from "../encounters.js";
import { enumerate } from "../utils.js";
import { getStrings, makeTranslationLookup } from "../io.js";

// There is a maximum of 75% chance that the Player will encounter
// a Random Combat Encounter while traveling on the Map
const MAXENCOUNTERRATE = .75;
// Each time the Player does not have a Random Combat Encounter,
// the chance of it happening increases by 15%
const ENCOUNTERRATEINCREMENT = .15;


const STRINGS = enumerate(

    // Unloading Messages
    "UNLOAD", "EMPTYUNLOAD",

    // The Unexplore Port Encounter Message
    "BANDIT",
    // The Port Encounter Message
    "PORT"

)
export class MapGUI{
    /**
     * 
     * @param {Map} map - The map object this GUI is responsible for
     */
    constructor(map){
        this.map = map;
        this.translate = makeTranslationLookup(this.map.game, STRINGS, "map");
        this.encounterRate = 0.0;
        // DEVNOTE- We need to be able to compare Arrays ([x,y] coordinates), but Arrays
        //      only compare by Identity. Storing them as an Object Key converts them to
        //      a string which we can then check for
        this.clearList = {};
    }

    get game(){ return this.map.game;}
    get mapBox(){ return document.getElementById("mapBox"); }
    // NOTE- using mapGUI instead of map because map is already assigned to the Map Instance
    get mapGUI(){ return document.getElementById("map");}

    setupUI(){
        this.game.UI.gamewindow.insertAdjacentHTML('afterbegin', `
<div id="mapBox" class="popup hidden">
    <div id="foodRepairBox">
        <div data-type="hp"><span>HP: </span><span data-value></span>/<span data-max></span></div>
        <div data-type="fuel"><span>Reactor Power: </span><span data-value></span></div>
        <div data-type="repair"><span>Repair Bots: </span><span data-value></span></div>
    </div>
    <div id="map"></div></div>
</div>
`);
        // Updates Player HP and Resources
        this.game.PLAYER.addEventListener("equipmentchange", this.updateHPSupplies.bind(this));
        this.game.PLAYER.addEventListener("itemadded", this.updateHPSupplies.bind(this));
        this.game.PLAYER.addEventListener("itemremoved", this.updateHPSupplies.bind(this));
        this.game.PLAYER.addEventListener("hpchange", this.updateHPSupplies.bind(this));
        this.game.PLAYER.addEventListener("currentHPchange", this.updateHPSupplies.bind(this));
        // Updates the map display
        this.map.addEventListener("moveend", this.updateMap.bind(this));

        // Navigates the map using keypresses
        document.addEventListener("keypress", this.move.bind(this));

        // Returns to The Colony
        this.map.addEventListener("entercolony", this.enterColony.bind(this));
        // Enters an Unexplored Port
        this.map.addEventListener("enterunexplored", this.enterUnexplored.bind(this));
        // Enters a Port
        this.map.addEventListener("enterport", this.enterPort.bind(this));

        // Clears structures so they can't be further exploited by the Player
        this.map.addEventListener("leaveunexplored", this.leaveStructure.bind(this));
        this.map.addEventListener("leaveplanet", this.leaveStructure.bind(this));
        this.map.addEventListener("leavestation", this.leaveStructure.bind(this));

        // Generate Random Encounters
        this.map.addEventListener("moveend", this.checkRandomEncounter.bind(this));

        // Callback to check if we need remove the mapLock after Enconters are finished
        this.game.addEventListener("noencounter", this.checkMapLock.bind(this));


        // Make sure Player starts out at Home (regardless of loading from Save or New Game)
        this.map.moveToHome();
        // Spoof a Moveend to make sure vision and map are updated
        // DEVNOTE- updateMap doesn't actually inspect the event, but we'll atlease supply the eventtype
        this.updateMap({eventtype: "moveend"});
        // Update all Supplies
        // DEVNOTE- Since we're spoofing events, we're only providing the bare minimum dummy info required
        this.updateHPSupplies({eventtype: {description:"equipmentchange"}, subtype: "fuel"});
        this.updateHPSupplies({eventtype: {description:"itemadded"}, item: {type:{id:0}}});
        this.updateHPSupplies({eventtype: {description:"currentHPchange"}});
        this.updateHPSupplies({eventtype: {description:"hpchange"}});
    }


    /** Updates the Map on the GUI
     * 
     * @param {MapEvent} event - the Map's moveend event
     */
    updateMap(event){
        // Update vision
        this.map.setVision(this.map.mask, this.map.playerLocation, this.game.PLAYER.statistics.vision);
        // Create a replacement for visited ports
        let replacements = [];
        // Add each visited Port to the replacements Array
        for(let location of Object.values(this.clearList)){
            // Visited Ports are removed and replaced with an Empty Symbol
            replacements.push([location,MAP.EMPTY]);
        }

        let string = this.map.getMap({replacements});
        this.mapGUI.innerHTML = `<pre>${string.join("<br>")}</pre>`;
    }


    /**
     * Updates Map GUI based on various change events
     * @param {PlayerEvent} event - One of currentHPchange, hpchange, equipmentchange, or itemschange
     */
    updateHPSupplies(event){
        // Our transport's fuel has changed, so update it
        if(event.eventtype.description == "equipmentchange" && event.subtype == "fuel"){
            let power = 0;
            // Map UI is setup on Game Initialization, so if this is a new Game the Player will
            // not have a transport
            if(this.game.PLAYER.transport && typeof this.game.PLAYER.transport !== "undefined") power = this.game.PLAYER.transport.reactorPower;
            // Update GUI to reflect current Transport Reactor Power and return 
            return this.mapBox.querySelector(`div[data-type="fuel"]>span[data-value]`).textContent =  power;
        }
        // Our Current HP has changed
        if(event.eventtype.description == "currentHPchange"){
            // Update GUI to reflect current Player HP and return 
            return this.mapBox.querySelector(`div[data-type="hp"]>span[data-value]`).textContent = this.game.PLAYER.statistics.currentHP;
        }
        // Our Max HP has changed
        if(event.eventtype.description == "hpchange"){
            // Update GUI to reflect new Player HP and return 
            return this.mapBox.querySelector(`div[data-type="hp"]>span[data-max]`).textContent = this.game.PLAYER.statistics.hp;
        }
        // Our Repair Bots have changed (id == 0)
        // NOTE- Technically, the only remaining category is Items, but we'll check anyway
        if((event.eventtype.description == "itemadded" || event.eventtype.description == "itemremoved") && event.item.type.id == 0){
            // Get repairbots (second argument is returnEmpty: have Player ensure that an Item Instance is returned)
            let repairbots = this.game.PLAYER.getItem(0, true);
            // Update GUI to reflect current QTY of Repair Bots and return 
            return this.mapBox.querySelector(`div[data-type="repair"]>span[data-value]`).textContent = repairbots.quantity;
        }
    }

    /** Prepares the Map to be shown, then shows it*/
    showMap(){
        // Reset our Random Encounter Rate
        this.encounterRate = 0;

        // Reset our clearList which contains Visited Ports
        this.clearList = {};

        // Make sure the Player's Fuel is toppedoff
        this.game.PLAYER.transport.topOff();

        // Make sure Player is at Home
        this.map.moveToHome();
        // Spoof a move event for good measure
        // DEVNOTE- this currently should have not unwanted edgecases
        this.updateMap({eventtype: "moveend"});

        // DEVNOTE- Since we have callbacks set up, everything on the Map Popup should be up to date

        // Show the map
        this.mapBox.classList.remove("hidden");
        this.mapBox.classList.add("shown");
        // Allow Movement
        this.map.mapLock = false;
    }


    /**
     * If the Game is done displaying all EncounterSequences and the map is visible, reenable Map control
     * @param {GameEvent} event - The Game's noencounter event
     */
    checkMapLock(event){
        // If the Map is visible, the only time it should be Locked is during Encounters
        // This is a callback for noencounters, so there are no encounters being shown
        if(this.mapBox.classList.contains("shown")) this.map.mapLock = false;
    }

    /**
     * Updates the player's location based on what key was pressed
     * 
     * @param {Event} - The keypress event
     */
    move(event){
        // Bail early if map is locked
        if(this.map.mapLock) return;

        // Get key pressed and look it up in the keybinding
        let direction = this.game.UI.keybindings.KEYDIRECTIONS[event.key];
        // Unkown, skip
        if(!direction || typeof direction == "undefined") return;

        // Add to queue
        GAME.MAP.playerQueue.push(new MAP.MapAction(MAP.mapactions.MOVE, direction));

        // Stop the event
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    /**
     * When the Player returns to the Colony, we relock the Map, let him know we're collecting his Resources, restore the Player to max HP, and hide the Map
     * @param {MapEvent} event - The Map's entercolony event
     */
    enterColony(event){
        // Prevent Movement
        this.map.mapLock = true;

        function dropResources(){
            let player = this.game.PLAYER;
            // Establish which resource the player needs to use his weapons so we don't drop them
            let keep = [];
            // Iterate over the weapons
            for(let weapon of player.weapons){
                // Not a weapon
                if(!weapon || typeof weapon == "undefined") continue;
                // If it needs ammunition, note the ammunition
                if(weapon.weapontype.requiresAmmunition) keep.push(weapon.weapontype.ammunition);
            }

            // Collect resources we are moving so that we can trigger the resourcechange event afterwards
            let resources = {}
            // Iterate over the Player's resources
            for(let [key,resource] of Object.entries(player.resources)){
                // If resourceID in keep, do nothing
                if(keep.indexOf(parseInt(key)) >= 0) continue;

                // Resource is empty already, so skip
                if(!resource.quantity) continue;

                // Record how much we're moving
                resources[resource.type.id] = resource.quantity;
                
                // Remove the resource from the Player
                player.removeResource(resource.type.id);

                // Add to the Colony
                this.game.COLONY.addResource(resource);
            }

            // Trigger resourcesmodified for TheColony
            // The Colony expects a [id, qty] array
            this.game.COLONY.triggerEvent("resourcesmodified", {resourcechange: Object.entries(resources)});

            // Player should have negative quantities
            for(let [id, qty] of Object.entries(resources)) resources[id] = -qty
            // Trigger resourceschange for player
            player.triggerEvent("resourceschange", {resources});
            
        };
        
        // Get description of the population for Message
        let population = this.game.COLONY.ui.getDescriptor();
        // Default message
        let message = STRINGS.UNLOAD;
        // If no meeple in The Colony, use EMPTYUNLOAD instead
        if(!this.game.COLONY.meeples.length) message = STRINGS.EMPTYUNLOAD;

        // Build drop callback encounter
        let callback = new ENCOUNTERS.CallbackEncounter({
            game: GAME, 
            message: this.translate(message, population),
            callback: dropResources,
        });

        // Add to the EncounterSequence
        this.game.getOrAddEncounter(callback);

        // Reset the Player's HP
        this.game.PLAYER.setHP(this.game.PLAYER.statistics.hp);

        // Hide the map
        this.mapBox.classList.remove("shown");
        this.mapBox.classList.add("hidden");
    }


    /**
     * When the Player exits an UnexploredPort, PLanet, or Station, replace that structure with a Port so they
     * can't gain additional rewards from it
     * @param {MapEvent} event - One of the following Map Events: leaveunexplored, leaveplanet, leavestation
     */
    leaveStructure(event){
        // The playerLocation is the square that the Player is leaving, so we need to replace that location
        let location = event.playerLocation;
        // Tell the map to clear the location
        // NOTE- Technically, clearStructureAtLocation still has access to the Player's
        //      location (since the player hasn't actually moved yet), but we'll confirm
        //      the location to be on the safe side
        this.map.clearStructureAtLocation(location);
    }

    /**
     * When the Player enters an Unexplored Port, it generates a Basic Combat Sequence
     * @param {MapEvent} event - The Map's enterunexplored event
     */
    enterUnexplored(event){
        // Lock Map so Player can't move
        this.map.mapLock = true;

        /**
         * Callback to generate an appropriate Pre-Combat message for the Encounter
         * @param {import("../encounters.js").CombatEncounterBuilderInfo} options - Info about the combat being built
         * @returns {String} - The Message to display
         */
        function messageCallback(options){
            // Get localized Bandit Name
            let bandit = getStrings(this.game.STRINGS, options.enemy);

            // return the localized Message
            return this.translate(STRINGS.BANDIT, {opponent:bandit.name});
        }
        

        // Create Basic Combat Sequence
        let sequence = ENCOUNTERS.buildUnexploredPortSequence(this.game, messageCallback.bind(this));

        // Hand the sequence to the game
        this.game.getOrAddEncounter(sequence);
    }

    /**
     * When the Player enters a Port (a structure that has already been explored) they 
     * @param {MapEvent} event - The map's enterport event
     */
    enterPort(event){
        // Lock Map so Player can't move
        this.map.mapLock = true;

        // Check if port is in our clearList
        if(typeof this.clearList[event.destination] !== "undefined"){
            // Return without starting a new encounter anything if we already visited it
            // Also, make sure to unlock the Map
            return this.map.mapLock = false;
        }

        // Add Port to our clearList so it is removed from the Map GUI (until
        // the Player visits The Colony again)
        this.clearList[event.destination]=event.destination;

        // The Player gets a topoff on his Transport and may collect Repair Bots
        let sequence = ENCOUNTERS.buildPortSequence(this.game, this.translate(STRINGS.PORT));

        // Add the sequence to the game
        this.game.getOrAddEncounter(sequence);
    }

    /**
     * Whenever the player finishes a move, check if a Random Encounter is created
     * @param {MapEvent} - The moveend Map Event
     */
    checkRandomEncounter(event){
        // If the Map is locked, then something else happened (e.g.- Entered a Station)
        // so don't generate a Random Encounter
        if(this.map.mapLock) return;

        /** DEVNOTE- Currently we start out with a 0% chance of generating an Encounter
         *      and increment that by 15% (to a max of 75%) each time an Encounter does
         *      not occur. When an Encounter does occur, the chance resets to 0%.
         */

        // Determine whether an Encounter occurred
        if(this.game.random() > this.encounterRate)
            // Encounter was not generated, so just increase encounter rate and return
            return this.encounterRate = Math.min(MAXENCOUNTERRATE, this.encounterRate+ENCOUNTERRATEINCREMENT);

        // Otherwise, generate a Random Encounter
        // Start by locking the Map so the Player can't move
        this.map.mapLock = true;

        // Use distance from the Colony as the tier
        let tier = this.map.getLocationTier(this.map.playerLocation);
        
        // Build encounter
        let sequence = ENCOUNTERS.buildCombatEncounter(this.game, null, null, {tier});

        // Add to the Game
        this.game.getOrAddEncounter(sequence);

        // Reset Encounter Rate because we triggered one
        this.encounterRate = 0;
    }
}