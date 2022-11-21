import re
import datetime
import dataclasses
import pathlib

@dataclasses.dataclass
class Session:
    number: int
    segments: list["Segment"] = dataclasses.field(default_factory=list)
    
@dataclasses.dataclass
class Segment:
    start: datetime.datetime
    end: datetime.datetime

    @property
    def duration(self):
        return self.end - self.start

SERE = re.compile("^#+?\s*Session\s*(?<sessionnumber>\d+)")
DTRE = re.compile("^\s*\*\s*(?P<datetime>(?P<date>(?P<month>\d+)-(?P<day>\d+)-(?P<year>\d+))\s+(?P<time>(?P<hour>\d+):(?P<minute>\d+)\s*(?P<apm>am|pm)))-\s*(?P<type>[Ss]tart|[Ee]nd)\s*$")

def parse(file: str = None):
    if file is None:
        file: pathlib.Path = (pathlib.Path.cwd() / "README.md").resolve()
    else: file = pathlib.Path(file).resolve()
    if not file.exists():
        raise FileNotFoundError(f"Could not load file {file}")
    
    sessions = []    
    with open(file, 'r') as f:
        
        while (line := f.readline()):
            if (result := SERE.search(line)):
                sessions.append(Session(int(result.group("sessionnumber"))))
                continue
            if (result := DTRE.search(line)):
                dt = result.group("datetime")
                dt = datetime.datetime.strptime(dt, "%m-%d-%Y %I:%M%p")
                
