"use-strict";

import { loadSave, saveFile, makeTranslationLookup } from "../io.js";
import { enumerate } from "../utils.js";
import * as KEYBINDINGS from "../keybindings.js";
import * as ENCOUNTERS from "../encounters.js";
import * as ENCOUNTERSGUI from "./encounters.js";

export class GameGUI{
    // Generic Translations
    STRINGS = enumerate(
        // None
        "NONE",
        // Equipment Types
        "RESOURCES", "ITEMS", "WEAPONS", "ARMOR", "TRANSPORTS",
        // Game Management
        "NEW", "SAVE", "LOAD", "QUIT",
        // Game Over Messages
        "GAMEOVER","FUELGAMEOVER", "REPAIRGAMEOVER","HPGAMEOVER", "COMBATGAMEOVER"
    )

    constructor(game, demos){
        this.game = game;
        if(typeof demos == "undefined") demos = null;
        this.demos = demos;

        this.translate = makeTranslationLookup(this.game, this.STRINGS, "game");
        // Store keybindings for other GUI modules to access
        this.keybindings = KEYBINDINGS;
    }

    get menu(){ return document.getElementById("menu"); }
    get gamewindow(){ return document.getElementById("gamewindow"); }
    
    setupUI(){
        document.body.insertAdjacentHTML("afterbegin", `<div id="menu" class="menu">
        <div id="mainmenu" class="menu">
            <button id="playbutton">${this.translate(this.STRINGS.NEW)}</button>
            <label>${this.translate(this.STRINGS.LOAD)}<input id="loadbutton" type="file" accept=".json"></input></label>
        </div>
    </div>
    <div id="gamewindow">
        <div id="events" class="popup hidden"></div>
        <div id="combat" class="popup hidden"></div>
    </div>`)
        document.getElementById("playbutton").onclick = this.newGame.bind(this);
        document.getElementById("loadbutton").addEventListener("change", this.loadSave.bind(this));
        if(this.demos) this.demos(this.game);
    }

    /**
     * Called when a New Game is either created or Loaded from a Save File
     */
    initializeListeners(){
        // GameGUI handles Encounters
        // A new EncounterSequence has been added, we will automatically load the first encounter in it
        this.game.addEventListener("encountersequenceadded", (event)=> this.game.cycleEncounter());
        /**  The current Encounter in the Game's current EncounterSequence has changed */
        // We automatically initialize all encounters when they are started
        this.game.addEventListener("encounterstart", (event)=>event.encounter.initialize());
        // Once the encounter is done being initialized, we can load it into the GUI
        this.game.addEventListener("encounterinitialized", this.establishEncounter.bind(this));
        // Need to update the UI when there is no Encounter to display
        this.game.addEventListener("encountersequenceremoved", (event)=>ENCOUNTERSGUI.updateSequenceGUI(null));
        // Some sequences automatically call cycleEncounter which defaults to autoRemove=false
        // In these cases, noencounter is raised.
        // DEVNOTE- We're just clearing the EncounterSequence when it is empty until we have a reason not to
        this.game.addEventListener("noencounter", (event)=>this.game.clearEncounter());

        // If the Transport runs out of Fuel, that prompts a Game Over
        this.game.MAP.addEventListener("nofuel", this.fuelGameOver.bind(this));
        // Whenever the map cannot remove a Repairbot, the Player loses a HP
        this.game.MAP.addEventListener("norepair", this.checkRepair.bind(this));
        // When the Player has no HP, that prompts a Game Over
        this.game.PLAYER.addEventListener("currentHPchange", this.checkHP.bind(this));
    }


    gameOver(message){
        // Start a new sequence with the given message followed by the Game Over Message
        let sequence = ENCOUNTERS.buildMessageSequence(this.game, [message, this.translate(this.STRINGS.GAMEOVER)]);
        // After the Messages, add a callback to exit the current game (exiting back to Main Menu)
        sequence.addEncounter(new ENCOUNTERS.CallbackEncounter({game: this.game, callback: this.exitToMainMenu.bind(this)}));
        // Force this sequence to be the only sequence on the stack
        this.game.setEncounter(sequence);
    }

    /**
     * When the Transport runs out of fuel (and tries to move), the Player gets a Game Over
     * @param {MapEvent} event - The Map's nofuel event
     */
    fuelGameOver(event){
        // DEVNOTE- We're not inspecting the event because it should only fire for
        //      a single reason, which we know
        this.gameOver(this.translate(this.STRINGS.FUELGAMEOVER));
    }

    /**
     * When the Player moves without having Repair Bots, the Player takes damage
     * @param {MapEven} event - The Map's norepair event
     */
    checkRepair(event){
        // DEVNOTE- Norepair only happens for one reason right now, so we don't
        //      need to inspect it
        // Deal 1 point of Damage to the Player for moving without Repair Bots
        // NOTE- adjustHP automatically triggers the currentHPchange event
        this.game.PLAYER.adjustHP(-1);
    }

    /**
     * Checks if the Player is still alive when the Player's HP has changed for some reason.
     * If the Player has died, try to deduce the reason and trigger the appropriate Game Over message
     * @param {CharacterEvent} event - The Character's currentHPchange event
     */
    checkHP(event){
        // We are going to check the Player's HP directly
        // If he's still alive, we don't need to do anything
        if(this.game.PLAYER.statistics.currentHP) return;


        // Otherwise we need to determine the situation
        // DEVNOTE- As more HP-Related Game Over situations arise, we'll handle them here

        // If the Map is unlocked, then the HP changed while the Player was travelling
        // This can only mean that he took damage from from lack of Repair Bots
        if(!this.game.MAP.mapLock) return this.gameOver(this.translate(this.STRINGS.REPAIRGAMEOVER));

        let currentEncounter = this.game.ENCOUNTER;

        // Player died during an Encounter
        if(currentEncounter){
            currentEncounter = currentEncounter.get();
            // Player died in Combat
            if(currentEncounter.type.description == "COMBAT") return this.gameOver(this.translate(this.STRINGS.COMBATGAMEOVER));
        }

        // This is a default Game Over message
        this.gameOver(this.translate(this.STRINGS.HPGAMEOVER));
    }

    /**
     * Updates the GUI for the given Encounter and sets up additional listeners if necessary
     * @param {GameEvent} event - The Game's encounterInitialized event
     */
    establishEncounter(event){
        // Update the GUI appropriately
        ENCOUNTERSGUI.updateSequenceGUI(event.encounter)
    }

    exitToMainMenu(){
        this.game.exitGame();
        while(this.gamewindow.lastElementChild) this.gamewindow.lastElementChild.remove();
        this.menu.style.display = "block";
    }

    newGame(){
        this.menu.style.display = "none";
        this.game.newGame();
        this.initializeListeners();
        this.game.COLONY.colonyLoop();
        this.game.MAP.moveLoop();
    }

    loadSave(event){
        loadSave(event.target.files[0], this.game._gameplayclass).then(
            game=>{
                this.menu.remove();
                this.gamewindow.remove();
                window.GAME = game;
                game.setupUI(this.demos);
                game.UI.setupUI();
                game.UI.menu.style.display = "none";
                game.setupGameplayUI();
                game.UI.initializeListeners();
                game.COLONY.colonyLoop();
                game.MAP.moveLoop();
            }
        )
    }

    saveGame(){
        saveFile(window.GAME);
    }

    traverseMainMenu(target){
        for(let child of this.menu.children) child.style.display="none";
        document.getElementById(target).style.display = "block";
    }
}