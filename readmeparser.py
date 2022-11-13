import re
import datetime

DTRE = re.compile("^\s*\*\s*(?P<datetime>(?P<date>(?P<month>\d+)-(?P<day>\d+)-(?P<year>\d+))\s+(?P<time>(?P<hour>\d+):(?P<minute>\d+)\s*(?P<apm>am|pm)))-\s*(?P<type>[Ss]tart|[Ee]nd)\s*$")