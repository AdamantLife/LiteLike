## GUI
import tkinter as tk
from tkinter import ttk

## Backend
import json
import pathlib

def getrelativepath(path):
    return (pathlib.Path.cwd() / path).resolve()

class FlatEntryBox(tk.Entry):
    def __init__(self, master , **kw):
        super().__init__(master, **kw)

        self._setflat()

        self.bind("<FocusIn>", self._seteditable)
        self.bind("<FocusOut>", self._setflat)

    def _setflat(self, *event):
        self.configure(relief ="flat", background="SystemButtonFace")

    def _seteditable(self, *event):
        self.configure(relief ="sunken", background="white")

class Pane(ttk.Frame):
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, *kw)
        self.master = master
    def packall(self, *args, **kw):
        for child in self.winfo_children():
            child.pack(*args, **kw)
    def gridall(self, columns, *args, **kw):
        for i,child in enumerate(self.winfo_children()):
            child.grid(column=i%columns, row=i//columns, *args, **kw)
    def clearall(self):
        for child in self.winfo_children():
            child.destroy()

    def loadpage(self, callback):
        self.clearall()
        callback()

class PopupPane(Pane):
    def __init__(self, master, *args, parent = None, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.parent = parent
        self.bind("<Destroy>", self.showparent)
        self.parent.pack_forget()

    def showparent(self, event):
        if self.parent:
            self.parent.pack(fill='both', expand=True)


class Main(Pane):
    def __init__(self, parent, **kw):
        super().__init__(parent, **kw)

        ttk.Label(self, text="LiteLike Data Manager", font = ("Times", 20, "bold"))

        for [window, text] in [
            [Colony, "Colony"],
            [Items, "Items"],
            [Encounters, "Encounters"],
            [Characters, "Characters"]
        ]:
            ttk.Button(self, text = text, command = lambda window = window: self.load(window))

        self.packall()

        
    def load(self, window):
        window(self.master).pack(fill='both', expand=True)
        self.destroy()

class DataLoader():
    def loaddata(self):
        with open(getrelativepath(self.JSON), 'r') as f:
            self.data = json.load(f)
    def loadenglish(self):
        with open(getrelativepath("LiteLike/strings/english.json"), 'r', encoding="utf-8") as f:
            self.english = json.load(f)
    def savedata(self):
        with open(getrelativepath(self.JSON), 'w') as f:
            json.dump(self.data, f)
    def saveenglish(self):
        with open(getrelativepath("LiteLike/strings/english.json"), 'w', encoding="utf-8") as f:
            json.dump(self.english, f)
    def getenglish(self, category, index):
        return self.english[category][index]
    
    def showindex(self):
        f = Pane(self)
        self.treeview = ttk.Treeview(f, show="tree")
        for (category, values) in self.data.items():
            self.treeview.insert("", "end", iid=category, text=category.capitalize(), open=True)
            for _id, item in enumerate(values):
                self.treeview.insert(category, "end", iid=f"{category}-{_id}", text=self.getenglish(category, _id)['name'])
        scroll = tk.Scrollbar(f, orient='vertical', command=self.treeview.yview)
        self.treeview['yscrollcommand']= scroll.set
        f.packall(side='left', fill='y')
    
class CategoryPage(Pane, DataLoader):
    def __init__(self, master, *args, title= None, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.loaddata()
        self.loadenglish()
        f = tk.Frame(self)
        ttk.Button(f, text="Back", command = self.loadmain).pack(side='left')
        ttk.Label(self, text=title, font=("times", 20, "bold"))
        self.showindex()
        self.packall()
        f.pack_configure(fill='x', expand = True)
        

    def loadmain(self):
        Main(self.master).pack(fill='both', expand=True)
        self.destroy()

class Colony(CategoryPage):
    JSON = "LiteLike/entities/colony.json"
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, title="Colony", **kw)

class Items(CategoryPage):
    JSON = "LiteLike/entities/items.json"
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, title = "Items", **kw)
        self.treeview.bind("<Double-Button-1>", self.open_page)
    def open_page(self, event):
        cat,id = self.treeview.identify_row(event.y).split("-")
        id = int(id)
        item = self.data[cat][id]
        SimpleDataEditor(self.master, id, cat, item = item, data=self.data, english = self.english, parent = self).pack(fill="both", expand = True)


class Encounters(Pane, DataLoader):
    JSON = "LiteLike/entities/encounters.json"
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.loaddata()
        self.loadenglish()
        f = tk.Frame(self)
        ttk.Button(f, text="Back", command = self.loadmain).pack(side='left')
        ttk.Label(self, text="Encounters", font=("times", 20, "bold"))
        self.treeview = ttk.Treeview(self, show="tree")
        for [category, languagename] in [
            ["combatants", "character"],
            ["noncombat", "encounter"]
        ]:
            self.treeview.insert("", "end", iid=category, text=category.capitalize(), open=True)
            for _id, item in enumerate(self.data.get(category, [])):
                self.treeview.insert(category, "end", iid=f"{category}-{_id}", text=self.getenglish(languagename, item['name'])['name'])
        self.treeview.insert("", "end", iid="tiers", text = "Tiers", open=True)
        for i in range(len(self.data['tiers'])):
            self.treeview.insert("tiers", 'end', iid=f"tier-{i}", text= f"Tier {i}")
        self.packall()
        f.pack_configure(fill='x', expand = True)

    def loadmain(self):
        Main(self.master).pack(fill='both', expand=True)
        self.destroy()

class Characters(Pane, DataLoader):
    JSON = None
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.loadenglish()
        f = tk.Frame(self)
        ttk.Button(f, text="Back", command = self.loadmain).pack(side='left')
        ttk.Label(self, text="Characters", font=("times", 20, "bold"))
        self.treeview = ttk.Treeview(self, show="tree")
        for _id, item in enumerate(self.english['character']):
            self.treeview.insert("", "end", iid=str(_id), text=item['name'])
        self.packall()
        f.pack_configure(fill='x', expand = True)

    def loadmain(self):
        Main(self.master).pack(fill='both', expand=True)
        self.destroy()

class SimpleDataEditor(PopupPane):
    DATATYPES = {
        "ammunition":{ "type":"resource" },
        "arguments": {
            "type":"list",
            "values":"any"
        },
        "callback":{"type":"string"},
        "capacity":{"type":"int"},
        "cooldown":{"type":"int"},
        "damage":{"type":"int"},
        "isConsumable": {"type": "bool"},
        "maxReactorPower":{"type":"int"},
        "range": {
            "type":"choice",
            "values":("MELEE", "RANGED", "LASER")
        },
        "shopCost": {
            "type":"list",
            "values":"resources"
        },
        "shopPrerequisites":{
            "type":"list",
            "values":"string"
        },
        "value":{"type":"int"},
        "warmup":{"type":"int"},
        "weight":{"type":"int"},
    }
    def __init__(self, master, id, itemtype, item, data, english, *args, parent = None, **kw) -> None:
        super().__init__(master, *args, parent= parent, **kw)
        self.id = id
        self.itemtype= itemtype
        self.data = data
        self.english = english

        name = "None"
        flavor = "No Flavor"
        if self.id is not None:
            strings = self.english[itemtype][self.id]
            name = strings['name']
            flavor = strings['flavor']
            
        self.nameentry = FlatEntryBox(self, font=("Times", 14, "bold"))
        self.nameentry.insert('end',name)
        self.flavorentry = FlatEntryBox(self, font=("Times", 12, "italic"))
        self.flavorentry.insert('end',flavor)
        
        f = Pane(self)
        for k,v in item.items():
            ttk.Label(f, text=k, font=("times",12, "bold"))
            attributeinfo = SimpleDataEditor.DATATYPES[k]
            if attributeinfo['type'] == "bool":
                iv = tk.IntVar()
                r = tk.Checkbutton(f, indicatoron=False, variable=iv)
                r.var = iv
                iv.trace_add("write", lambda *e, iv=iv: r.configure(text= "True" if iv.get() else "False"))
                iv.set(v)
            elif attributeinfo['type'] == "int":
                sp = tk.Spinbox(f, from_=0, to=9999999, increment=1.0)
                if v:
                    sp.insert(0,v)
                def roundInput(event):
                    sp = event.widget
                    value = sp.get()
                    sp.delete(0,'end')
                    try: value = int(float(value))
                    except: value = 0
                    sp.insert('end', value)
                sp.bind("<FocusOut>", roundInput)
            elif attributeinfo['type'] == "string":
                ttk.Entry(f).insert(0,v)
            elif attributeinfo['type'] == "resource":
                valuesnames =list(self.english['resource'])
                valuesnames.insert(0, "None")
                valuesnames.append("New Resource")
                c = ttk.Combobox(f, values=valuesnames, state="readonly")
                c.set(v if v else "")
                c.bind("<<ComboboxSelected>>", self.checkResource)
            elif attributeinfo['type'] == "choice":
                c = ttk.Combobox(f, values=SimpleDataEditor.DATATYPES[k]['values'], state="readonly")
                c.set(v)
            elif attributeinfo['type'] == "list":
                if attributeinfo['values'] in ["string","any"]:
                    ff = ttk.Frame(f)
                    l = tk.Listbox(ff, height=4)
                    if v:
                        l.insert('end', *v)
                    def deleteline(event):
                        l = event.widget
                        index = l.nearest(event.y)
                        bbox = l.bbox(index)
                        if(bbox[1]+bbox[3] < event.y or event.y < bbox[1]): return
                        l.delete(index)
                    l.bind("<Button-3>", deleteline)

                    e = tk.Entry(ff)
                    def submit(event,l):
                        e = event.widget
                        text = e.get()
                        e.delete(0,'end')
                        l.insert('end', text)
                    e.bind("<Return>", lambda event, l = l: submit(event, l))

                    for child in ff.winfo_children():
                        child.pack()
                elif attributeinfo['values'] == "resources":
                    if not v: v = []
                    v = {k:v for (k,v) in v}
                    t = ttk.Treeview(f, columns=["Name", "Qty"], show="headings")
                    for column in ["Name", "Qty"]:
                        t.heading(column, text = column)
                    for _id,resource in enumerate(self.data['resource']):
                        name = self.english['resource'][_id]['name']
                        t.insert('', 'end', _id, values=(name, v.get(_id,"")))
                    t.insert('', 'end', "NEWRESOURCE", values=("Add New Resource", ""))

                    def insertnew(t):
                        newid = len(self.data['resource'])-1
                        if t.item(newid): return
                        t.insert('', t.index('NEWRESOURCE')-1, values = (self.english['resource'][-1]['name'], ""))

                    def checknew(event):
                        t = event.widget
                        row = t.identify_row(event.y)
                        if row == "NEWRESOURCE":
                            self.createnewresource(lambda event, t = t: insertnew(t))

                    t.bind("<Double-Button-1>", checknew)
            else:
                ttk.Entry(f).insert(0,v)

        f.gridall(2)

        f = Pane(self)
        cancel = ttk.Button(f, text="Cancel", command = self.cancelandexit)
        save = ttk.Button(f, text="Save", command=self.saveandexit)
        f.packall(side='left')

        self.packall()
        
    def gatherdata(self):
        return {}

    def saveandexit(self):
        data = self.gatherdata()
        if self.id == None: self.data.append(data)
        else: self.data[self.id] = data
        self.exit()

    def cancelandexit(self):
        self.exit()

    def exit(self):
        self.destroy()

    def createnewresource(self, callback):
        resource = self.data['resource'][0]
        for k in resource: resource[k] = None
        SimpleDataEditor(self.master, id=None, itemtype="resource",item=resource, data=self.data, english=self.english, parent= self).pack(fill='both',expand=True)
        self.showcallback = self.bind("<Map>", callback)
        
    def checkResource(self, event):
        value = event.widget.get(0,'end')
        if(value == "NEW"):
            self.createnewresource(lambda event, widget = event.widget: self.resumeShowResource(widget))

    def resumeShowResource(self, widget):
        valuesnames = list(self.english['resource'])
        valuesnames.insert(0, "None")
        valuesnames.append("New Resource")
        widget.configure(values = valuesnames)
        widget.set(self.data['resource'][-1])


        
if __name__ == "__main__":
    root = tk.Tk()
    Main(root).pack(fill='both', expand=True)
    root.mainloop()