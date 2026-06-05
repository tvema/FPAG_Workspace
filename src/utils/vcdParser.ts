export interface VCDSignal {
  name: string;
  id: string;
  width: number;
  module: string;
  type: string;
}

export interface VCDTransition {
  time: number;
  val: string; // "0", "1", "x", "z", "b1010"
}

export interface VCDData {
  timescale: string;
  signals: VCDSignal[];
  data: Record<string, VCDTransition[]>; // id -> transitions
  maxTime: number;
}

export function parseVCD(vcdText: string): VCDData {
  const lines = vcdText.split('\n').map(l => l.trim()).filter(l => l);
  let state = 'HEADER';
  
  const signals: VCDSignal[] = [];
  const data: Record<string, VCDTransition[]> = {};
  let currentModule = 'top';
  let timescale = '1s';
  let maxTime = 0;
  
  let currentTime = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (state === 'HEADER') {
      if (line.startsWith('$timescale')) {
        const match = line.match(/\$timescale\s+(.*?)\s+\$end/);
        if (match) timescale = match[1];
        else if (lines[i+1] && lines[i+2] === '$end') {
          timescale = lines[i+1];
        }
      } else if (line.startsWith('$scope')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          currentModule = parts[2];
        }
      } else if (line.startsWith('$var')) {
        // $var wire 1 ! clk $end
        const match = line.match(/\$var\s+(\w+)\s+(\d+)\s+(\S+)\s+(\S+.*?)(\s+\$end)?$/);
        if (match) {
          const type = match[1];
          const width = parseInt(match[2], 10);
          const id = match[3];
          const name = match[4].replace(/\s*\$end$/, '').trim();
          if (!data[id]) {
            data[id] = [];
          }
          signals.push({ name, id, width, module: currentModule, type });
        }
      } else if (line === '$enddefinitions $end' || line.startsWith('$enddefinitions')) {
        state = 'DUMP';
      }
    } else if (state === 'DUMP') {
      if (line.startsWith('$dumpvars')) continue;
      if (line.startsWith('$end')) continue;
      
      if (line.startsWith('#')) {
        currentTime = parseInt(line.substring(1), 10);
        if (currentTime > maxTime) maxTime = currentTime;
      } else if (line.startsWith('b') || line.startsWith('B') || line.startsWith('r') || line.startsWith('R')) {
        // value string, e.g. b10101 !
        const parts = line.split(/\s+/);
        if (parts.length === 2) {
          const val = parts[0].substring(1); // without prefix b
          const id = parts[1];
          if (data[id]) {
            const arr = data[id];
            if (arr.length > 0 && arr[arr.length - 1].time === currentTime) {
              arr[arr.length - 1].val = val;
            } else {
              arr.push({ time: currentTime, val: val });
            }
          }
        }
      } else {
        // bit value, e.g. 1! or 0" or x#
        if (line.length > 1) { // ensure it's not empty
           const val = line.charAt(0);
           const id = line.substring(1);
           if (data[id] !== undefined) {
             const arr = data[id];
             if (arr.length > 0 && arr[arr.length - 1].time === currentTime) {
               arr[arr.length - 1].val = val;
             } else {
               arr.push({ time: currentTime, val });
             }
           }
        }
      }
    }
  }

  // Ensure 0 time transitions if not present
  signals.forEach(s => {
    if (data[s.id].length > 0 && data[s.id][0].time > 0) {
      data[s.id].unshift({ time: 0, val: s.width === 1 ? 'x' : 'x'.repeat(s.width) });
    } else if (data[s.id].length === 0) {
      data[s.id].push({ time: 0, val: s.width === 1 ? 'x' : 'x'.repeat(s.width) });
    }
  });

  return { timescale, signals, data, maxTime };
}
