import * as MAP from "../map.js";
import * as ENCOUNTERS from "../encounters.js";
import { enumerate } from "../utils.js";
import { makeTranslationLookup } from "../io.js";


const STRINGS = enumerate(

    // Unloading Messages
    "UNLOAD", "EMPTYUNLOAD"

)
export class MapGUI{
    /**
     * 
     * @param {Map} map - The map object this GUI is responsible for
     */
    constructor(map){
        this.map = map;
        this.translate = makeTranslationLookup(this.map.game, STRINGS, "map");
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
        // Setup Map
        this.updateMap();

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
        let string = this.map.getMap();
        this.mapGUI.innerHTML = `<pre>${string.join("<br>")}</pre>`;
    }


    /**
     * Updates Map GUI based on various change events
     * @param {PlayerEvent} event - One of currentHPchange, hpchange, equipmentchange, or itemschange
     */
    updateHPSupplies(event){
        // Our transport's fuel has changed, so update it
        if(event.eventtype.description == "equipmentchange" && event.subtype == "fuel"){
            // Update GUI to reflect current Transport Reactor Power and return 
            return this.mapBox.querySelector(`div[data-type="fuel"]>span[data-value]`).textContent =  this.game.PLAYER.transport.reactorPower;
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
     * When the Player returns to the Colony, we relock the Map, let him know we're collecting his Resources, and hide the Map
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
            for(let key of Object.keys(player.resources)){
                // If resourceID in keep, do nothing
                if(keep.indexOf(parseInt(key)) >= 0) continue;

                // Get the Resource
                let resource = player.getResource(key, true);

                // Resource is empty already, so skip
                if(!resource.quantity) continue;

                // Record how much we're moving
                resources[resource.type.id] = resource.quantity;
                // Player does not have a removeResource function right now, so we'll just
                // delete the key
                delete player.resources[resource.type.id];

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

        // Hide the map
        this.mapBox.classList.remove("shown");
        this.mapBox.classList.add("hidden");
    }
}