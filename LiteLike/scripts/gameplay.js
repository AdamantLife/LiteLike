"use-strict;"

import { sectors} from "./colony.js";
import * as COLONY from "./colony.js";
import * as UTILS from "./utils.js";
import * as IO from "./io.js";
import * as ENCOUNTERS from "./encounters.js";


/**
 * A class to implement Gameplay Unlock/Upgrade Trees/Sequences
 */
export class GameplaySequence{
    STRINGS = UTILS.enumerate(
        // Intro Message
        "NEWGAME",
        // Unlock Scrap Sector
        "FIRSTPOWER",
        "FIRSTPOWER1",
        // Unlock Shop
        "FIRSTSCRAP",
        // Unlock Residential
        "FIRSTBATTERY",
        // Unlocks Map
        "FIRSTTRANSPORT",

        // Unlock Events
        "CHARGINGUNLOCK"
    )

    FLAGS = UTILS.enumerate(
        // Begins generating random and pseudo-random events for The Colony
        "COLONYEVENTS"
    )
    constructor(game, flags = []){
        this.game = game;
        this.translate = IO.makeTranslationLookup(this.game, this.STRINGS, "gameplay");
        
        /**
         * The UNLOCKTREE consists of categories of state changes
         * Sector, Unlock, and Resource have Keys that the state
         *      change is compared to
         * The Key's associated value is an Object can contain the following:
         *      * sectors: An Array of Sector enumerations which are automatically added to TheColony.
         *          The sectors key is removed after the Sectors are added to TheColony.
         *      * unlocks: An Array of Unlock enumerations which are automatically unlocked on TheColony
         *          The unlocks key is removed after the Unlocks are unlocked on TheColony.
         *      * callbacks: An Array of Functions which are called with this.Game and the triggering Event as arguments.
         *          If the callback returns true, that callback will be removed from the callbacks Array.
         *          When all callbacks have been removed, the callbacks key will be itself be removed.
         */
        // DEVNOTE- We're defining the Tree directly on the Object so that we can easily
        // remove items from it that have already been achieved
        this.UNLOCKTREE = {
            "sector":{
            },
            "unlock":{
                [COLONY.unlocks.SECTORS]:{
                    sectors:[sectors.SCRAP]
                }
            },
            "cresource":{
                "1":{
                    callbacks: [
                        this.firstBattery.bind(this)
                    ]
                },
                "2":{
                    callbacks: [
                        this.firstScrap.bind(this),
                    ]
                }
            },
        }

        // These are possible Unlocks the Player can receive
        // NOTE- total and remaining are set inside of initialSetup
        this.UNLOCKEVENTS = {
            "colony":{
                "unlocks":{
                    [COLONY.unlocks.CHARGING]:this.unlockCharging
                },
                "sectors":{

                }
            },
            total: 0,
            remaining: 0
        }

        // Random Event timer
        this.colonyTimeout = null;
        this.flags = [];

        // Unlock flags
        let result;
        for(let flag of flags){
            // validate flag
            [flag, result] = this.validateFlag(flag);
            // Result indicates that the GameplaySequence already has it
            // so if it doesn't have it, add it
            if(!result) this.flags.push(flag);
        }

        // Now that flags are set, do any initial setup required
        // based on current gamestate
        this.initialSetup();

        // GameplaySequence updates its state on a variety of Events
        // Listeners are removed using function references: binding or using
        // arrow functions are unrecoverable, so we need to record those functions separately
        // in order to remove them
        // TODO- Consider changing addEventListener to return a listener id which can be recorder
        //          and subsequently change removeEventListener to take this id instead
        this.listeners = {
            "plm": this.firstPower.bind(this),
            "mm": this.firstMeeple.bind(this),
            "tp": this.firstTransport.bind(this),
            "ua": (event)=>this.checkState(event, "unlock"),
            "sa": (event)=>this.checkState(event, "sector"),
            "rc": (event)=>this.checkState(event, "cresource"),
            "rp": (event)=>this.checkState(event, "presource"),
        };
        this.game.COLONY.addEventListener("powerlevelmodified", this.listeners.plm);
        this.game.COLONY.addEventListener("meeplemodified", this.listeners.mm);
        this.game.PLAYER.addEventListener("equipmentchange", this.listeners.tp);
        this.game.COLONY.addEventListener("unlockadded", this.listeners.ua);
        this.game.COLONY.addEventListener("sectoradded", this.listeners.sa);
        this.game.COLONY.addEventListener("resourcesmodified", this.listeners.rc);
        this.game.PLAYER.addEventListener("resourceschange", this.listeners.rp);
    }

    /**
     * Perform any necessary setup based on the current gamestate (flags unlocked)
     * at time of initialization
     */
    initialSetup(){
        // Update total Unlock Events
        let sectors = Object.keys(this.UNLOCKEVENTS.colony.sectors), colonyUnlocks = Object.keys(this.UNLOCKEVENTS.colony.unlocks);
        this.UNLOCKEVENTS.total = sectors.length
                                    + colonyUnlocks.length;
        // Set default remaining to total
        this.UNLOCKEVENTS.remaining = this.UNLOCKEVENTS.total;

        /**
         * Helper function to make it easier to break the loop early
         * @param {COLONY.Sector} sector - The sector we're currently checking TheColony for
         * @returns {Boolean} - Whether or not TheColony has the sector already
         */
        function compareSectors(sector){
            for(let other of this.game.COLONY.sectors){
                // Return true if TheColony has a matching sectorType
                if(sector.sectorType == other.sectorType) return true;
            }
            // If we haven't returned true after going through all
            // of TheColony's sectors, null is returned implicitly
        }

        // Purge already Unlocked Events
        // DEVNOTE- We are maintaining a running total of remaining events because it's
        //      easier than constantly recalculting given the tree structure

        for(let sector of sectors){
            if(compareSectors(sector)){
                // If The Colony has the Sector, delete it from Unlock Events
                delete this.UNLOCKEVENTS.colony.sectors[sector];
                // Reduce the number of remaining Unlock Events
                this.UNLOCKEVENTS.remaining -= 1;
            }
        }

        // TheColony's checkUnlocks function is easy enough to check against
        let missing = this.game.COLONY.checkUnlocks(colonyUnlocks);
        for(let unlock of colonyUnlocks){
            // Unlock is not in Missing, i.e.- TheColony already has the unlock
            if(missing.indexOf(unlock) < 0){
                // Delete it
                delete this.UNLOCKEVENTS.colony.unlocks[unlock];
                // Reduce the number of remaining Unlock Events
                this.UNLOCKEVENTS.remaining -= 1;
            }
        }

        // If the COLONYEVENTS flag has been unlocked, start generating ColonyEvents
        if(!this.checkFlags([this.FLAGS.COLONYEVENTS]).length) this.setNextColonyTimeout();

        
    }



    /**
     * Attempts to coerce the flag into a valid flag Symbol and returns
     *  whether or not the GameplaySequence has the given flag
     * @param {Symbol | String} flag - The flag to validate
     * @returns {Array} - a length-2 array containing the conversion of the flag
     *          (undefined if not a valid symbol) and a boolean indicating whether
     *          the GameplaySequence has the flag
     */
     validateFlag(flag){
        // Make sure prereq is Symbol
        if(typeof flag !== "symbol") flag = this.FLAGS[flag];

        // Return whether the flag is in in our flag list
        return [flag, this.flags.indexOf(flag) >= 0];
   }

    /**
     * Checks whether the GameplaySequence has the given flags, returning any it does not have
     * @param {Symbol[] | String[]} flags - A list of flags to check
     * @returns {Symbol[]}- A list of flags that the GameplaySequence does not have
     */
     checkFlags(flags){
        // Make sure we have all the flags
        let noflags = [];
        let result;
        for (let flag of flags){
            [flag, result] = this.validateFlag(flag);
            if(!result) noflags.push(flag);
        }
        return noflags;
    }

    setNextColonyTimeout(){
        // After a random amount of time between 1 and 3 minutes
        // TODO: undo debugging timer
        //          debugging timer is between 30seconds and 1 minute
        this.colonyTimeout = window.setTimeout(this.generateColonyEvent.bind(this), 30000+this.game.random()*15000*2);
    }

    cancelNextColonyTimeout(){
        if(this.colonyTimeout) window.clearTimeout(this.colonyTimeout);
    }

    /**
     * [Possibly] generates a new Colony Event
     */
    generateColonyEvent(){
        // Randomly select between a Randomly Generated Event
        // and a Colony Unlock Event
        if(UTILS.randomChoice(["randomevent", "unlockevent"], this.game.random) == "randomevent"){
            // TODO- Implement Random Events
            return this.setNextColonyTimeout();
        }
        // (Possible) unlock event

        //If we don't have any unlock events left, just return now
        if(!this.UNLOCKEVENTS.remaining) return this.setNextColonyTimeout();

        // Chance of unlocking is proportional to the percentage of unlocks remaining
        // DEVNOTE- We're assuming at the moment that chance is 0.0 ... 1.0
        // TODO: Adjust the formula for better gameplay
        let chance = this.UNLOCKEVENTS.remaining / this.UNLOCKEVENTS.total;

        // If we failed to get below chance, exit and set next event timeout
        if(this.game.random() > chance) return this.setNextColonyTimeout();
        
        // Generate a random number between 0 and the number of remaining unlocks
        let choice = Math.floor(
            // Random (which is 0 inclusive and 1.0 exclusive) mulitplied by the remaining
            // maxes us out at: e.g.- remaining = 3 => ~2.97. Since we're taking indices
            // anyway, this is fine.
            this.game.random() * this.UNLOCKEVENTS.remaining
            ) 
        // Traverse all Unlocks until we get to choice index
        // DEVNOTE- We are using an index and treating the UNLOCKEVENTS tree as a
        //      flat object so that all unlocks have an equal chance to get selected
        function recurseTree(obj, currentIndex){
            // If the obj is an Object, then we can check its values and possibly recurse
            if(typeof obj == "object"){
                for(let [key, value] of Object.entries(obj)){
                    // Unlock keys are coupled with callback functions
                    // We technically could also check if key is a Symbol, but
                    // this seems less likely to change in the future
                    if(typeof value == "function"){
                        // If currentIndex is 0, then we have the unlock we want
                        if(!currentIndex){
                            // Purge unlock so we can't get it again
                            delete obj[key];
                            // We'll return the callback and let the root-level call it
                            return [value, currentIndex];
                        }
                        // Otherwise, we reduce the currentIndex and continue
                        currentIndex -=1;
                        continue;
                    }
                    // Otherwise, try to recurse on the value
                    let result;
                    [result, currentIndex] = recurseTree(value, currentIndex);
                    // If the recursion provided a result, return immediately
                    if(result) return [result, currentIndex];
                }
            }
            

            // This recursion did not result in anything, so return
            return [null, currentIndex];
        }

        // Recurse to find choice
        let [result, remainingIndex] = recurseTree(this.UNLOCKEVENTS, choice);
        // DEVNOTE- we should check here ot make sure remainingIndex is 0
        //      as it is a serious problem if it is not, but since we don't 
        //      raise errors in this program, we'll just ignore it
        // DEVNOTE2- Along the same lines, we're blindly calling result because
        //      there should be no way that recurseTree does not return a function

        // Call the Unlock Event function 
        // DEVNOTE- The callback is responsible for calling setNextColonyTimeout
        //      when it is done; we want to wait until the Player has resolved
        //      any Encounters triggered by the callback before starting the next one
        result.bind(this)();

        // Reduce Remaining
        // DEVNOTE- The recursion does not maintain a reference to `this`, so
        //      we it's easier to do this outside of the recursion
        this.UNLOCKEVENTS.remaining -=1;
    }

    /**
     * When the gamestate changes (e.g.- TheColony gets a new unlock), check to see if that change
     * triggers further changes
     * @param {Event} event - Any number of events the Gameplay may be listening for
     * @param {String} type - The UNLOCKTREE type key
     */
    checkState(event, type){
        let lookup = this.UNLOCKTREE[type];
        // We have no more triggers for this eventtype,
        // so make sure eventtype is unregistered and return
        if(typeof lookup == "undefined"|| !lookup || !Object.values(lookup).length) return this.unregisterEvent(event.eventtype);

        // Resource can be multiple resources, so we're going to use an array
        // as default
        let lookupValues = [];
        if(type == "unlock" || type == "sector") lookupValues.push(event[type]);
        else if(type == "cresource"){
            for(let [resourceid, qty] of event.resourcechange) lookupValues.push(resourceid);
        }
        else if(type == "presource"){
            for(let resourceid of Object.keys(event.resources)) lookupValues.push(resourceid);
        }

        for(let lookupValue of lookupValues){
            // All triggers for the lookup
            let triggers = lookup[lookupValue];
            // This type does not have any (remaining) triggers associated with it
            if(!triggers || typeof triggers == "undefined") continue;
            // For each trigger type, handle it

            let sectors = triggers.sectors;
            // This trigger grants some number of sectors to TheColony
            if(sectors && typeof sectors !== "undefined"){
                for(let sector of sectors){
                    // Get the Sector Object from the Game and add it to TheColony
                    this.game.COLONY.addSector(this.game.SECTORS[sector]);
                }
                // Since all sectors were added, remove sectors from the triggers
                delete triggers.sectors;
            }

            let unlocks = triggers.unlocks;
            // This trigger grants some number of unlocks to TheColony
            if(unlocks && typeof unlocks !== "undefined"){
                for(let unlock of unlocks){
                    // Add the unlocks to TheColony
                    this.game.COLONY.unlock(unlock);
                }
                // Since all unlocks were added, remove unlocks from the triggers
                delete triggers.sectors;
            }

            let callbacks = triggers.callbacks;
            // This trigger causes a number of callbacks to be called
            if(callbacks && typeof callbacks !== "undefined"){
                // Make a copy of the list because we're going to
                // be removing successful callbacks
                callbacks = Array.from(callbacks);
                for(let index = 0; index < callbacks.length; index++){
                    // Call the callback with game and event as the arguments
                    let result = callbacks[index](this.game, event);
                    // If the result is successful (true), we can remove this callback from the list
                    if(result) triggers.callbacks.splice(index,1);
                }
                // If we have successfully executed all remaining callbacks,
                // remove callbacks from triggers
                if(!triggers.callbacks.length) delete triggers.callbacks;
            }

            // If no more triggers remain, remove triggers from lookup
            if(!Object.values(triggers).length) delete lookup[lookupValue];
        }
        // Now that we're done removing stuff, check if the lookup is now empty
        // If it is empty, unregister its listener
        if(!Object.values(lookup).length) this.unregisterEvent(event.eventtype);
    }

    /**
     * Determines where the EventListener is registered and what it is registered to,
     * then removes it so it will not be called again.
     * @param {String} eventtype - an Event.eventtype
     */
    unregisterEvent(eventtype){
        let sender, callback;
        switch(eventtype){
            case "unlockadded":
                sender = this.game.COLONY;
                callback = this.listeners.ua;
                break;
            case "sectoradded":
                sender = this.game.COLONY;
                callback = this.listeners.ua;
                break;
            case "resourceschange":
                sender = this.game.PLAYER;
                callback = this.listeners.rp;
                break;
        }
        // No such sender
        // DEVNOTE- As always, should technically raise an Error
        if(!sender) return;
        sender.removeEventListener(eventtype, callback);
    }

    /**
     * When the player starts a new game, display the following message
     */
    newGame(){
        this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.NEWGAME));
    }

    /**
     * When the Player first supplies power to TheColony, grant TheColony the SECTORS 
     */
    firstPower(){
        // If the COLONY already unlocked SECTORS, skip and remove listener
        if(!this.game.COLONY.checkUnlocks(["SECTORS"]).length) return this.game.COLONY.removeEventListener("powerlevelmodified", this.listeners.plm);

        // Unlock sectors
        this.game.COLONY.unlock("SECTORS");
        // There are no other powerlevelmodified unlocks, so remove listener
        this.game.COLONY.removeEventListener("powerlevelmodified", this.listeners.plm);

        // Slowrolling the Messages as to not bombard the player
        window.setTimeout(()=>{
            this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTPOWER));
            window.setTimeout(()=>{this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTPOWER1));}, 3000);
        }, 3000);
    }

    /**
     * When the Player collects his first piece of scrap via Salvage, we unlock the store
     */
    firstScrap(game, event){
        // We already know that the resourcechange has happened
        // and that scrap is in the resourcechange, so we don't
        // need to check anything
        for(let [res, qty] of event.resourcechange){
            // We're only interested in gaining (positive qty)
            // scrap
            if(res == 2 && qty > 0){
                // The Colony already has the Shop unlocked, so skip
                if(!this.game.COLONY.checkUnlocks([COLONY.unlocks.SHOP]).length) return true;
                this.game.COLONY.unlock(COLONY.unlocks.SHOP);
                // Notify the player
                this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTSCRAP));

                // Return True so that we can remove this callback
                return true;
            }
        }
    }

    /**
     * When the Player purchases his first Battery from the Shop, unlock Residential Sector and Meeple UI
     */
    firstBattery(game, event){
        // We already know that the resourcechange has happened
        // and that battery is in the resourcechange, so we don't
        // need to check anything
        for(let [res, qty] of event.resourcechange){
            // We're only interested in gaining (positive qty) batteries
            if(res == 1 && qty > 0){
                // COLONY already has the RESIDENTIAL sector, so skip
                if(!this.game.COLONY.checkSectors([this.game.SECTORS[sectors.RESIDENTIAL]]).length) return true;
                // Add the Residential sector to The Colony
                this.game.COLONY.addSector(this.game.SECTORS[sectors.RESIDENTIAL]);

                // Notify the player
                this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTBATTERY));

                // Return True so that we can remove this callback
                return true;
            }
        }
    }

    /**
     * When the Colony gets its first Meeple, unlock Colony Event and setNextColonyTimeout (see generateColonyEvent)
     */
    firstMeeple(event){
        // We already have the ColonyEvents flag, so remove listener and return without doing anything
        if(!this.checkFlags([this.FLAGS.COLONYEVENTS]).length) return this.game.COLONY.removeEventListener("meeplemodified",this.listeners.mm);
        // Unlock Colony Events
        this.flags.push(this.FLAGS.COLONYEVENTS);
        // Queue up next event timout
        this.setNextColonyTimeout();
        // Make sure to remove listener so we don't keep triggering this event
        this.game.COLONY.removeEventListener("meeplemodified",this.listeners.mm);
    }

    /**
     * When the Player gets his first transport, unlock the Cargo Bay (access to the Overworld Map)
     */
    firstTransport(event){
        // The Colony already has the Map unlocked, so remove listener and do nothing
        if(!this.game.COLONY.checkUnlocks(["MAP"]).length) return this.game.PLAYER.removeEventListener("equipmentchange", this.listeners.tp);
        // Check to make sure it's the right event (transport)
        if(!event.subttype == "transport") return;
        // Unlock Map on Colony
        this.game.COLONY.unlock("MAP");
        // Give the Player feedback
        this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTTRANSPORT))
        // Remove Listener
        this.game.PLAYER.removeEventListener("equipmentchange", this.listeners.tp);
    }

    /** COLONY UNLOCK EVENTS
     * 
     * The Player has a random chance to unlock certain Colony Sectors and Meeple Jobs
     * as part of the Roguelite gameplay.
     * These are the events which trigger those unlocks
     */
    unlockCharging(){
        // Show unlock message
        this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.CHARGINGUNLOCK, this.game.COLONY.ui.getDescriptor()));
        // Unlock on TheColony
        this.game.COLONY.unlock("CHARGING");
        // Set next colony timeout
        this.setNextColonyTimeout();
    }
}