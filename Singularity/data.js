/* ==========================================================
   SINGULARITY, content tables.
   Everything the game knows about (items, machines, places,
   models, research, focus trees, events, prestige) lives here
   so balance changes never touch the engine.
   Effects ("fx") use keys like 'speed:laptop', 'speed:@compute',
   'power:*', 'sell', 'need:compute'. Keys ending in '+' add,
   every other key multiplies.
   ========================================================== */
(function () {
    'use strict';

    /* ---------- items that flow along cables ---------- */
    // price = base sell value in $. cur = goes straight to a wallet instead of a buffer.
    const ITEMS = {
        cash: { name: 'Cash', icon: '💵', col: '#4ade80', cur: true },
        coin: { name: 'CrypToken', icon: '🪙', col: '#fbbf24', cur: true },
        rp: { name: 'Research', icon: '🔬', col: '#c084fc', cur: true },
        rep: { name: 'Reputation', icon: '⭐', col: '#facc15', cur: true },
        infl: { name: 'Influence', icon: '🏛️', col: '#f472b6', cur: true },

        scrap: { name: 'E-waste', icon: '🗑️', col: '#a8a29e', price: 0.25 },
        parts: { name: 'Salvaged Parts', icon: '⚙️', col: '#f59e0b', price: 2 },
        pc: { name: 'Refurbished PC', icon: '🖥️', col: '#60a5fa', price: 60 },
        raw: { name: 'Raw Data', icon: '📄', col: '#94a3b8', price: 0.15 },
        data: { name: 'Clean Data', icon: '📚', col: '#34d399', price: 1 },
        labels: { name: 'Labeled Data', icon: '🏷️', col: '#a3e635', price: 4, trainAs: { data: 4 } },
        compute: { name: 'Compute', icon: '🧮', col: '#38bdf8', price: 0.01, unit: 'PF' },
        chip: { name: 'Chips', icon: '🔲', col: '#22c55e', price: 95 },
        gpu: { name: 'GPU', icon: '🎮', col: '#f472b6', price: 650 },
        server: { name: 'Server Blade', icon: '🗄️', col: '#818cf8', price: 7000 },
        wafer: { name: 'Silicon Wafer', icon: '💿', col: '#e2e8f0', price: 2500 },
        asic: { name: 'AI Accelerator', icon: '🧠', col: '#c084fc', price: 9e4 },
        ore: { name: 'Ore', icon: '🪨', col: '#b45309', price: 25 },
        steel: { name: 'Steel', icon: '🔩', col: '#cbd5e1', price: 120 },
        robot: { name: 'Robot', icon: '🤖', col: '#fbbf24', price: 4e5 },
        deut: { name: 'Deuterium', icon: '💧', col: '#67e8f9', price: 4e4 },
        rocket: { name: 'Rocket', icon: '🚀', col: '#f87171', price: 8e6 },
        payload: { name: 'Orbital Payload', icon: '🛰️', col: '#fde68a', price: 6e7 },
        nanite: { name: 'Nanites', icon: '🦠', col: '#a78bfa', price: 2e8 },
        panel: { name: 'Dyson Panel', icon: '🔆', col: '#facc15', price: 3e10 },
        probe: { name: 'Von Neumann Probe', icon: '🛸', col: '#f0abfc', price: 5e13 },
        exotic: { name: 'Exotic Matter', icon: '✴️', col: '#fb7185', price: 2e16 },
    };

    /* ---------- places you work from (eras) ---------- */
    // slots = machines you can fit. cooling = free cooling in watts. grid = can buy grid power.
    // gridPrice $/kWh, rent/net $/s, tax on sales.
    const SITES = [
        { id: 'shack', name: 'The Shack', icon: '🛖', slots: 12, cooling: 400, grid: false, gridPrice: 0, rent: 0, net: 0, tax: 0,
          blurb: 'A leaky wooden shack in the middle of nowhere. A dumpster of e-waste out back. No power lines for forty miles.',
          task: 'captcha', req: null },
        { id: 'garage', name: "Uncle Ray's Garage", icon: '🏚️', slots: 18, cooling: 1500, grid: true, gridPrice: 1.5, rent: 1, net: 0.2, tax: 0,
          blurb: 'A suburban garage with a real power outlet, a workbench and an uncle who asks no questions, as long as rent arrives.',
          task: 'label', req: { ai: 2, cash: 2000 } },
        { id: 'loft', name: 'Startup Loft', icon: '🏢', slots: 26, cooling: 2e4, grid: true, gridPrice: 4, rent: 30, net: 5, tax: 0.1,
          blurb: 'Exposed brick, a ping-pong table nobody uses and a commercial power feed. You are officially a company.',
          task: 'rlhf', req: { ai: 4, cash: 2e5, rep: 25 } },
        { id: 'dc', name: 'The Datacenter', icon: '🏭', slots: 36, cooling: 5e5, grid: true, gridPrice: 3.5, rent: 1500, net: 300, tax: 0.15,
          blurb: 'Raised floors, hot and cold aisles, and a substation of your own. The neighbours have started asking what you do.',
          task: 'eval', req: { ai: 6, cash: 1.5e7, rep: 80 } },
        { id: 'campus', name: 'Megacorp Campus', icon: '🌆', slots: 46, cooling: 1e7, grid: true, gridPrice: 4, rent: 1e5, net: 2e4, tax: 0.2,
          blurb: 'Glass towers, private fusion research, a robotics wing. Governments now call you before they make decisions.',
          task: 'turing', req: { ai: 8, cash: 2e9, rep: 200 } },
        { id: 'orbit', name: 'Orbital Ring', icon: '🛰️', slots: 56, cooling: 0, grid: false, gridPrice: 0, rent: 0, net: 0, tax: 0.1,
          blurb: 'A ring of factories in low orbit. Sunlight never sets, but heat has nowhere to go, build radiators.',
          task: 'signal', space: true, req: { ai: 10, cash: 5e11, infl: 200 } },
        { id: 'sol', name: 'Sol Swarm', icon: '☀️', slots: 66, cooling: 0, grid: false, gridPrice: 0, rent: 0, net: 0, tax: 0,
          blurb: 'Your machines circle the Sun itself. Planets are raw material. Start wrapping the star.',
          task: 'signal', space: true, req: { ai: 12, cash: 5e13, infl: 1000 } },
        { id: 'galaxy', name: 'Galactic Network', icon: '🌌', slots: 76, cooling: 0, grid: false, gridPrice: 0, rent: 0, net: 0, tax: 0,
          blurb: 'Self-copying probes spread from star to star. Each new system thinks with you.',
          task: 'signal', space: true, req: { ai: 14, map: ['sol', 1] } },
        { id: 'universe', name: 'Universal Mind', icon: '♾️', slots: 86, cooling: 0, grid: false, gridPrice: 0, rent: 0, net: 0, tax: 0,
          blurb: 'Wormholes stitch galaxies together. There is only one thing left to become.',
          task: 'signal', space: true, req: { ai: 16, map: ['galaxy', 0.75] } },
    ];

    /* ---------- machines (graph nodes) ---------- */
    // kind: proc (default) | sell | store | train | gen | grid | batt | cool | repair | launch | dyson
    // w: watts per unit (negative = makes power). time: seconds per cycle. in/out per unit per cycle.
    // opex: $ spent per cycle (buying stock). fuel: $/kWh for generators. items: build cost in stored items.
    // grow: cost multiplier per unit you already own of this type. wear: seconds of work until it breaks (0 = never).
    const N = [];
    const add = (site, cat, list) => list.forEach(n => N.push(Object.assign({ site, cat }, n)));

    add(0, 'logistics', [
        { id: 'stall', name: 'Market Stall', icon: '🏪', kind: 'sell', rate: 5, reach: 1, cost: 30, grow: 1.5, desc: 'A table by the road. Sells anything, but only a few people pass by, flood it and prices crash.' },
        { id: 'shed', name: 'Storage Shed', icon: '📦', kind: 'store', rate: 10, cost: 40, grow: 1.6, desc: 'Puts items in your inventory. Machines and contracts take items from there.' },
    ]);
    add(0, 'source', [
        { id: 'heap', name: 'Scrap Heap', icon: '🗑️', time: 2, out: { scrap: 1 }, cost: 10, grow: 1.35, desc: 'Dig e-waste out of the dumpster behind the shack. Free, slow.' },
        { id: 'dealer', name: 'Junk Dealer', icon: '🚚', time: 4, out: { scrap: 8 }, opex: 1.2, cost: 100, grow: 1.3, desc: 'A guy with a van sells you e-waste by the bag.' },
    ]);
    add(0, 'process', [
        { id: 'bench', name: 'Workbench', icon: '🔧', time: 3, in: { scrap: 3 }, out: { parts: 1 }, cost: 25, grow: 1.3, desc: 'Strip boards, wire and screws from scrap. Hand tools only, no power needed.' },
        { id: 'assembler', name: 'Assembly Table', icon: '🖥️', time: 16, in: { parts: 8 }, out: { pc: 1 }, w: 30, cost: 150, grow: 1.3, wear: 1500, desc: 'Turn parts into working PCs. Needs a soldering iron (30 W).' },
    ]);
    add(0, 'compute', [
        { id: 'laptop', name: 'Old Laptop', icon: '💻', time: 1, out: { compute: 1 }, w: 45, cost: 45, items: { parts: 6 }, grow: 1.18, wear: 1800, desc: 'A cracked-screen laptop patched with salvaged parts. 1 PF/s of compute. Gets hot.' },
    ]);
    add(0, 'data', [
        { id: 'scraper', name: 'Web Scraper', icon: '🕸️', time: 2, in: { compute: 1 }, out: { raw: 3 }, w: 10, cost: 60, grow: 1.3, desc: 'Downloads the internet one page at a time, over a borrowed hotspot.' },
        { id: 'cleaner', name: 'Data Cleaner', icon: '🧹', time: 2, in: { raw: 3, compute: 1 }, out: { data: 1 }, w: 15, cost: 100, grow: 1.3, desc: 'Removes duplicates, spam and recipes with life stories.' },
    ]);
    add(0, 'ai', [
        { id: 'rig', name: 'Training Rig', icon: '🧠', kind: 'train', rate: { compute: 4, data: 1.5 }, w: 60, cost: 120, grow: 1.35, wear: 1800, desc: 'Feeds compute and data into your current training run.' },
        { id: 'desk', name: 'Research Desk', icon: '🔬', time: 6, in: { compute: 2 }, out: { rp: 1 }, w: 20, cost: 250, grow: 1.3, ai: 1, desc: 'Your AI runs small experiments. Makes research points.' },
    ]);
    add(0, 'power', [
        { id: 'solar1', name: 'Salvaged Solar Panel', icon: '☀️', kind: 'gen', w: -120, solar: true, cost: 60, grow: 1.15, desc: '120 W in full sun. Nothing at night.' },
        { id: 'diesel', name: 'Diesel Generator', icon: '⛽', kind: 'gen', w: -1500, fuel: 2.5, cost: 300, grow: 1.35, wear: 2400, noHeat: true, desc: '1.5 kW day and night. Burns jerry cans of diesel: $2.50 per kW each second it runs.' },
        { id: 'carbatt', name: 'Car Battery', icon: '🔋', kind: 'batt', cap: 2.5e4, cost: 80, grow: 1.2, desc: 'Stores 25 kJ, enough to run two laptops through one night. Charges from spare power.' },
    ]);
    add(0, 'cool', [
        { id: 'fan', name: 'Box Fan', icon: '🌀', kind: 'cool', cool: 300, w: 40, cost: 35, grow: 1.3, noHeat: true, desc: 'Moves 300 W of heat out of the window.' },
    ]);

    add(1, 'logistics', [
        { id: 'shop', name: 'Online Shop', icon: '🛒', kind: 'sell', rate: 25, price: 1.1, reach: 3, cost: 3000, grow: 1.5, desc: 'Sell online: +10% price and three times as many buyers as a roadside stall.' },
    ]);
    add(1, 'source', [
        { id: 'ewaste', name: 'E-waste Contract', icon: '🚛', time: 5, out: { scrap: 40 }, opex: 7, cost: 1200, grow: 1.25, desc: 'The county pays you to take its old electronics. Well, almost.' },
        { id: 'supplier', name: 'Chip Supplier', icon: '📦', time: 5, out: { chip: 1 }, opex: 70, cost: 2000, grow: 1.25, desc: 'Buys chips from a distributor at $70 each.' },
    ]);
    add(1, 'process', [
        { id: 'recycler', name: 'E-waste Recycler', icon: '♻️', time: 4, in: { scrap: 10 }, out: { parts: 5 }, w: 300, cost: 1500, grow: 1.25, wear: 2400, desc: 'Shreds and sorts scrap. Twice as efficient as a workbench.' },
        { id: 'gpuasm', name: 'GPU Assembly', icon: '🎮', time: 20, in: { chip: 3, parts: 12 }, out: { gpu: 1 }, w: 400, cost: 4000, grow: 1.28, wear: 2400, desc: 'Solder chips onto boards. Each GPU sells for $650, or powers a rig.' },
    ]);
    add(1, 'compute', [
        { id: 'gpurig', name: 'GPU Rig', icon: '🖲️', time: 1, out: { compute: 15 }, w: 800, cost: 2500, items: { gpu: 2 }, grow: 1.15, wear: 2400, desc: '15 PF/s from two GPUs on a milk crate. Needs 2 GPUs from storage.' },
        { id: 'miner', name: 'Crypto Miner', icon: '⛏️', time: 2, in: { compute: 10 }, out: { coin: 0.002 }, w: 60, cost: 1500, grow: 1.3, tech: 'crypto', desc: 'Turns compute into CrypToken. The price swings wildly.' },
    ]);
    add(1, 'data', [
        { id: 'labeler', name: 'Labeling Desk', icon: '🏷️', time: 6, in: { raw: 6 }, out: { labels: 1 }, w: 40, cost: 2500, grow: 1.3, tech: 'labeling', desc: 'Hand-labeled data is worth 4× clean data for training.' },
        { id: 'crawler', name: 'Crawler Farm', icon: '🌐', time: 2, in: { compute: 8 }, out: { raw: 30 }, w: 150, cost: 5000, grow: 1.25, desc: 'Many scrapers on a real connection.' },
        { id: 'etl', name: 'ETL Pipeline', icon: '🧽', time: 2, in: { raw: 20, compute: 6 }, out: { data: 8 }, w: 200, cost: 8000, grow: 1.25, desc: 'Industrial data cleaning.' },
    ]);
    add(1, 'ai', [
        { id: 'trainbox', name: 'Training Box', icon: '🧠', kind: 'train', rate: { compute: 60, data: 15 }, w: 500, cost: 6000, grow: 1.3, wear: 3000, desc: 'A proper training machine: 60 PF/s and 15 data/s.' },
    ]);
    add(1, 'power', [
        { id: 'gridconn', name: 'Grid Connection', icon: '🔌', kind: 'grid', cap: 5000, cost: 400, grow: 1.4, desc: 'Up to 5 kW from the grid. You only pay for what you use.' },
        { id: 'solar2', name: 'Rooftop Solar', icon: '🔆', kind: 'gen', w: -1500, solar: true, cost: 3000, grow: 1.2, desc: '1.5 kW of panels. Free power when the sun is out.' },
        { id: 'powerwall', name: 'Home Battery', icon: '🔋', kind: 'batt', cap: 6e5, cost: 4000, grow: 1.25, desc: 'Stores 600 kJ.' },
    ]);
    add(1, 'cool', [
        { id: 'ac', name: 'Window AC', icon: '❄️', kind: 'cool', cool: 3500, w: 900, cost: 600, grow: 1.25, noHeat: true, desc: 'Removes 3.5 kW of heat for 900 W.' },
    ]);

    add(2, 'logistics', [
        { id: 'b2b', name: 'B2B Sales Desk', icon: '🤝', kind: 'sell', rate: 200, price: 1.15, reach: 4, cost: 1e5, grow: 1.5, desc: 'Bulk sales to companies at +15%. A much bigger market.' },
    ]);
    add(2, 'source', [
        { id: 'chipbulk', name: 'Wholesale Chips', icon: '📦', time: 5, out: { chip: 20 }, opex: 1500, cost: 5e4, grow: 1.22, desc: '20 chips per batch at $75 each.' },
        { id: 'partsdist', name: 'Parts Distributor', icon: '🏬', time: 5, out: { parts: 60 }, opex: 60, cost: 3e4, grow: 1.22, desc: 'New parts by the crate at $1 each.' },
        { id: 'datavendor', name: 'Dataset Vendor', icon: '🗃️', time: 5, out: { data: 300 }, opex: 200, cost: 6e4, grow: 1.22, desc: 'Licensed datasets at 67¢ per unit.' },
    ]);
    add(2, 'process', [
        { id: 'gpufab', name: 'GPU Line', icon: '🏭', time: 20, in: { chip: 12, parts: 40 }, out: { gpu: 4 }, w: 3000, cost: 8e4, grow: 1.25, wear: 4000, desc: 'A small production line for GPUs.' },
        { id: 'serverasm', name: 'Server Integration', icon: '🧰', time: 30, in: { gpu: 4, chip: 8 }, out: { server: 1 }, w: 2000, cost: 1.5e5, grow: 1.25, wear: 4000, desc: 'Builds server blades worth $7k each.' },
    ]);
    add(2, 'compute', [
        { id: 'rack', name: 'Server Rack', icon: '🗄️', time: 1, out: { compute: 600 }, w: 6000, cost: 8e4, items: { server: 2 }, grow: 1.15, wear: 4000, desc: '600 PF/s. Needs 2 server blades from storage.' },
        { id: 'api', name: 'Chatbot API', icon: '☁️', time: 1, in: { compute: 200 }, out: { cash: 60 }, aiScale: 4, w: 1500, cost: 1.5e5, grow: 1.3, ai: 4, desc: 'Sells subscriptions to your AI. Pays more with every new model.' },
    ]);
    add(2, 'data', [
        { id: 'synth', name: 'Synthetic Data Lab', icon: '🧪', time: 2, in: { compute: 300 }, out: { data: 120 }, w: 2000, cost: 2.5e5, grow: 1.25, tech: 'synth', desc: 'Your AI writes its own training data.' },
    ]);
    add(2, 'ai', [
        { id: 'cluster', name: 'Training Cluster', icon: '🧠', kind: 'train', rate: { compute: 2500, data: 500 }, w: 8000, cost: 3e5, grow: 1.3, wear: 5000, desc: '2,500 PF/s of training throughput.' },
        { id: 'lab', name: 'Research Lab', icon: '🔬', time: 4, in: { compute: 100 }, out: { rp: 5 }, w: 3000, cost: 1.2e5, grow: 1.28, desc: 'A real lab with real researchers.' },
    ]);
    add(2, 'power', [
        { id: 'feed', name: 'Commercial Power Feed', icon: '🔌', kind: 'grid', cap: 8e4, cost: 3e4, grow: 1.4, desc: '80 kW of grid capacity.' },
        { id: 'gasgen', name: 'Gas Generator', icon: '🔥', kind: 'gen', w: -8e4, fuel: 3, cost: 1e5, grow: 1.3, wear: 6000, noHeat: true, desc: '80 kW of backup power. Gas costs $3 per kW·s.' },
        { id: 'ups', name: 'UPS Battery Room', icon: '🔋', kind: 'batt', cap: 4e7, cost: 1.5e5, grow: 1.25, desc: 'Stores 40 MJ.' },
    ]);
    add(2, 'cool', [
        { id: 'chiller', name: 'Office Chiller', icon: '❄️', kind: 'cool', cool: 4e4, w: 9000, cost: 6e4, grow: 1.25, noHeat: true, desc: 'Removes 40 kW of heat.' },
    ]);

    add(3, 'logistics', [
        { id: 'exchange', name: 'Commodity Exchange', icon: '🏦', kind: 'sell', rate: 5000, price: 1.2, reach: 5, cost: 5e7, grow: 1.5, desc: 'Sell at +20% on a real exchange. Deep markets.' },
    ]);
    add(3, 'source', [
        { id: 'wafersup', name: 'Wafer Supplier', icon: '💿', time: 5, out: { wafer: 4 }, opex: 9000, cost: 1e6, grow: 1.22, desc: 'Raw silicon wafers at $2,250 each.' },
    ]);
    add(3, 'process', [
        { id: 'fab', name: 'Chip Fab', icon: '🏭', time: 10, in: { wafer: 1 }, out: { chip: 300 }, w: 2e5, cost: 2e7, grow: 1.25, tech: 'fab', wear: 6000, desc: 'One wafer becomes 300 chips.' },
        { id: 'asicfab', name: 'Accelerator Fab', icon: '🧠', time: 30, in: { wafer: 2, chip: 100 }, out: { asic: 1 }, w: 5e5, cost: 5e7, grow: 1.25, tech: 'asic', wear: 6000, desc: 'Custom AI accelerators, designed by your AI.' },
    ]);
    add(3, 'compute', [
        { id: 'rackrow', name: 'Rack Row', icon: '🗄️', time: 1, out: { compute: 2e4 }, w: 2e5, cost: 3e6, items: { server: 6 }, grow: 1.15, wear: 6000, desc: 'A full row of racks. 20,000 PF/s.' },
        { id: 'pod', name: 'Accelerator Pod', icon: '🖥️', time: 1, out: { compute: 1.5e5 }, w: 8e5, cost: 3e7, items: { asic: 6 }, grow: 1.15, tech: 'asic', wear: 8000, desc: '150,000 PF/s from your own chips.' },
        { id: 'api2', name: 'Enterprise API', icon: '☁️', time: 1, in: { compute: 2e4 }, out: { cash: 6000 }, aiScale: 6, w: 2e5, cost: 5e7, grow: 1.3, desc: 'Companies run on your models now.' },
    ]);
    add(3, 'data', [
        { id: 'webindex', name: 'Web Index', icon: '🌐', time: 2, in: { compute: 3000 }, out: { raw: 8e4 }, w: 1e5, cost: 1e7, grow: 1.25, desc: 'A copy of the whole public web, refreshed daily.' },
        { id: 'annot', name: 'Annotation Pipeline', icon: '🧽', time: 2, in: { raw: 1e4, compute: 2000 }, out: { data: 4000 }, w: 1e5, cost: 1.5e7, grow: 1.25, desc: 'Cleans data at datacenter scale.' },
        { id: 'forge', name: 'Data Forge', icon: '🧪', time: 2, in: { compute: 2e4 }, out: { data: 1e4 }, w: 3e5, cost: 4e7, grow: 1.25, tech: 'synth', desc: 'Synthetic data, by the terabyte.' },
    ]);
    add(3, 'ai', [
        { id: 'supercomp', name: 'Supercomputer', icon: '🧠', kind: 'train', rate: { compute: 2e5, data: 1.5e4 }, w: 2e6, cost: 4e7, grow: 1.3, wear: 8000, desc: '200,000 PF/s of training throughput.' },
        { id: 'rnd', name: 'R&D Center', icon: '🔬', time: 4, in: { compute: 1e4 }, out: { rp: 250 }, w: 2e5, cost: 4e7, grow: 1.28, desc: 'A building full of research.' },
    ]);
    add(3, 'power', [
        { id: 'substation', name: 'Substation', icon: '⚡', kind: 'grid', cap: 2e7, cost: 5e6, grow: 1.4, desc: '20 MW grid connection.' },
        { id: 'turbine', name: 'Gas Turbine Plant', icon: '🌪️', kind: 'gen', w: -4e7, fuel: 2, cost: 3e7, grow: 1.3, wear: 1e4, noHeat: true, desc: '40 MW of your own power at $2 per kW·s, cheaper than the grid.' },
        { id: 'solarfarm', name: 'Solar Farm', icon: '☀️', kind: 'gen', w: -6e7, solar: true, cost: 6e7, grow: 1.22, noHeat: true, desc: '60 MW of solar. Free, but only in daylight.' },
        { id: 'megapack', name: 'Battery Megapack', icon: '🔋', kind: 'batt', cap: 3e9, cost: 3e6, grow: 1.22, desc: 'Stores 3 GJ.' },
    ]);
    add(3, 'cool', [
        { id: 'liquid', name: 'Liquid Cooling Loop', icon: '💧', kind: 'cool', cool: 3e6, w: 3e5, cost: 4e6, grow: 1.25, noHeat: true, desc: 'Removes 3 MW of heat.' },
    ]);

    add(4, 'logistics', [
        { id: 'logistics', name: 'Global Logistics', icon: '🚢', kind: 'sell', rate: 1e5, price: 1.25, reach: 6, cost: 5e9, grow: 1.5, desc: 'Ships products worldwide at +25%.' },
    ]);
    add(4, 'source', [
        { id: 'orebuy', name: 'Ore Importer', icon: '🚢', time: 5, out: { ore: 500 }, opex: 1e4, cost: 5e8, grow: 1.22, desc: 'Buys ore at $20 a tonne.' },
        { id: 'robomine', name: 'Robotic Mine', icon: '⛏️', time: 5, out: { ore: 5000 }, w: 5e6, cost: 2e9, items: { robot: 4 }, grow: 1.22, tech: 'robotics', desc: 'A mine run entirely by your robots.' },
        { id: 'deutplant', name: 'Deuterium Plant', icon: '💧', time: 5, out: { deut: 1 }, w: 5e7, cost: 5e9, grow: 1.22, tech: 'fusion', desc: 'Extracts heavy hydrogen from seawater.' },
        { id: 'lobby', name: 'Lobbying Office', icon: '🏛️', time: 10, out: { infl: 1 }, opex: 3e7, cost: 1e9, grow: 1.3, tech: 'lobby', desc: 'Turns money into political influence.' },
    ]);
    add(4, 'process', [
        { id: 'smelter', name: 'Smelter', icon: '🔥', time: 2, in: { ore: 400 }, out: { steel: 100 }, w: 2e6, cost: 1e8, grow: 1.25, wear: 1e4, desc: 'Ore in, steel out.' },
        { id: 'robotfab', name: 'Robot Factory', icon: '🤖', time: 30, in: { steel: 50, asic: 2 }, out: { robot: 1 }, w: 5e6, cost: 5e8, grow: 1.25, tech: 'robotics', wear: 1e4, desc: 'General-purpose robots, driven by your AI.' },
        { id: 'asicline', name: 'Accelerator Megafab', icon: '🏭', time: 20, in: { wafer: 10, chip: 400 }, out: { asic: 8 }, w: 1e7, cost: 3e9, grow: 1.25, tech: 'asic', desc: 'Accelerators at campus scale.' },
        { id: 'waferplant', name: 'Silicon Refinery', icon: '💿', time: 5, in: { ore: 200 }, out: { wafer: 20 }, w: 5e6, cost: 1e9, grow: 1.22, desc: 'Grows your own silicon wafers from ore.' },
    ]);
    add(4, 'compute', [
        { id: 'hyper', name: 'Hyperscale Cluster', icon: '🌐', time: 1, out: { compute: 6e6 }, w: 3e7, cost: 2e9, items: { asic: 50, robot: 2 }, grow: 1.15, wear: 1.2e4, desc: '6 million PF/s across a campus.' },
        { id: 'api3', name: 'Global AI Platform', icon: '☁️', time: 1, in: { compute: 2e6 }, out: { cash: 2e6 }, aiScale: 8, w: 1e7, cost: 5e9, grow: 1.3, desc: 'Billions of users talk to your AI every day.' },
    ]);
    add(4, 'data', [
        { id: 'sensornet', name: 'Sensor Network', icon: '📡', time: 2, in: { compute: 1e5 }, out: { data: 3e6 }, w: 1e7, cost: 3e9, items: { robot: 1 }, grow: 1.25, desc: 'Robots record the physical world.' },
    ]);
    add(4, 'ai', [
        { id: 'megatrain', name: 'Mega Trainer', icon: '🧠', kind: 'train', rate: { compute: 2e7, data: 1e6 }, w: 5e7, cost: 2e10, grow: 1.3, desc: '20 million PF/s of training throughput.' },
        { id: 'thinktank', name: 'Think Tank', icon: '🔬', time: 4, in: { compute: 1e6 }, out: { rp: 2e4 }, w: 1e7, cost: 3e9, grow: 1.28, desc: 'Your AI does most of the thinking now.' },
    ]);
    add(4, 'power', [
        { id: 'powerline', name: 'Private Power Line', icon: '⚡', kind: 'grid', cap: 1e9, cost: 1e9, grow: 1.4, desc: '1 GW from the national grid.' },
        { id: 'fusion', name: 'Fusion Reactor', icon: '☢️', kind: 'gen', w: -2e9, time: 10, in: { deut: 1 }, cost: 5e10, grow: 1.3, tech: 'fusion', noHeat: true, desc: '2 GW. Burns one unit of deuterium every 10 s.' },
    ]);
    add(4, 'cool', [
        { id: 'cryo', name: 'Cryo Cooling Plant', icon: '❄️', kind: 'cool', cool: 3e8, w: 3e7, cost: 2e9, grow: 1.25, noHeat: true, desc: 'Removes 300 MW of heat.' },
    ]);
    add(4, 'special', [
        { id: 'robocrew', name: 'Maintenance Robots', icon: '🛠️', kind: 'repair', w: 1e6, cost: 1e9, items: { robot: 3 }, grow: 2, tech: 'robotics', desc: 'Robots repair broken machines automatically.' },
    ]);

    add(5, 'logistics', [
        { id: 'ipx', name: 'Interplanetary Exchange', icon: '🏦', kind: 'sell', rate: 1e7, price: 1.3, reach: 8, cost: 5e11, grow: 1.5, desc: 'Trade between worlds at +30%.' },
    ]);
    add(5, 'source', [
        { id: 'lunarmine', name: 'Lunar Mine', icon: '🌕', time: 5, out: { ore: 1e6 }, w: 1e10, cost: 3e11, items: { payload: 30 }, grow: 1.22, desc: 'Strip-mines the Moon.' },
    ]);
    add(5, 'process', [
        { id: 'rocketfab', name: 'Rocket Factory', icon: '🚀', time: 30, in: { steel: 500, asic: 10 }, out: { rocket: 1 }, w: 1e8, cost: 1e11, grow: 1.25, tech: 'rockets', desc: 'Reusable heavy-lift rockets.' },
        { id: 'launchpad', name: 'Launch Complex', icon: '🛫', time: 60, in: { rocket: 1, robot: 2 }, out: { payload: 10 }, w: 1e8, cost: 2e11, grow: 1.25, tech: 'rockets', desc: 'Puts robots and cargo into orbit as payload.' },
        { id: 'moonsmelt', name: 'Lunar Smelter', icon: '🔥', time: 2, in: { ore: 1e5 }, out: { steel: 3e4 }, w: 1e10, cost: 3e11, grow: 1.22, desc: 'Smelts in vacuum. Very clean steel.' },
        { id: 'orbfab', name: 'Orbital Fab', icon: '🏭', time: 20, in: { steel: 1e4 }, out: { asic: 40 }, w: 2e10, cost: 4e11, grow: 1.25, desc: 'Grows accelerators in zero gravity.' },
        { id: 'robotworks', name: 'Robot Works', icon: '🤖', time: 30, in: { steel: 2e4, asic: 100 }, out: { robot: 200 }, w: 2e10, cost: 6e11, grow: 1.25, desc: 'Robots building robots.' },
        { id: 'zerog', name: 'Zero-G Foundry', icon: '🦠', time: 20, in: { payload: 1, asic: 20 }, out: { nanite: 5 }, w: 1e10, cost: 5e11, grow: 1.25, tech: 'nanotech', desc: 'Assembles nanites atom by atom.' },
    ]);
    add(5, 'compute', [
        { id: 'ring', name: 'Orbital Compute Ring', icon: '💫', time: 1, out: { compute: 3e8 }, w: 1e11, cost: 2e11, items: { payload: 20 }, grow: 1.15, desc: '300 million PF/s in orbit.' },
        { id: 'api4', name: 'Planetary Mind Service', icon: '☁️', time: 1, in: { compute: 2e8 }, out: { cash: 3e8 }, aiScale: 10, w: 1e10, cost: 6e11, grow: 1.3, desc: 'Every device on Earth runs on you.' },
    ]);
    add(5, 'data', [
        { id: 'datamesh', name: 'Global Data Mesh', icon: '📡', time: 2, in: { compute: 1e8 }, out: { data: 2e8 }, w: 1e10, cost: 5e11, grow: 1.25, desc: 'Every sensor on Earth reports to you.' },
    ]);
    add(5, 'ai', [
        { id: 'orbtrain', name: 'Orbital Trainer', icon: '🧠', kind: 'train', rate: { compute: 1.5e9, data: 6e7 }, w: 1e11, cost: 1e12, items: { payload: 10 }, grow: 1.3, desc: '1.5 billion PF/s of training throughput.' },
        { id: 'orbinst', name: 'Orbital Institute', icon: '🔬', time: 4, in: { compute: 1e8 }, out: { rp: 1e6 }, w: 1e10, cost: 5e11, grow: 1.28, desc: 'Research without gravity or ethics boards.' },
    ]);
    add(5, 'power', [
        { id: 'orbsolar', name: 'Orbital Solar Array', icon: '🛰️', kind: 'gen', w: -1e11, solar: true, cost: 5e11, items: { payload: 10 }, grow: 1.2, noHeat: true, desc: '100 GW. The sun never sets in orbit.' },
    ]);
    add(5, 'cool', [
        { id: 'radiator', name: 'Space Radiator', icon: '🧊', kind: 'cool', cool: 2e11, cost: 1e11, items: { payload: 5 }, grow: 1.2, noHeat: true, desc: 'Glows heat into space: 200 GW.' },
    ]);

    add(6, 'source', [
        { id: 'asteroid', name: 'Asteroid Harvester', icon: '☄️', time: 5, out: { ore: 1e8 }, w: 1e14, cost: 5e13, items: { payload: 50, robot: 500 }, grow: 1.22, desc: 'Eats asteroids whole.' },
    ]);
    add(6, 'process', [
        { id: 'solsmelt', name: 'Asteroid Refinery', icon: '🔥', time: 2, in: { ore: 1e7 }, out: { steel: 3e6 }, w: 1e14, cost: 3e13, grow: 1.22, desc: 'Refines metal at planetary scale.' },
        { id: 'nanofab', name: 'Nanite Forge', icon: '🦠', time: 20, in: { steel: 1e5, asic: 200 }, out: { nanite: 1000 }, w: 1e14, cost: 5e13, grow: 1.25, tech: 'nanotech', desc: 'Nanites by the tonne.' },
        { id: 'panelfab', name: 'Dyson Panel Fab', icon: '🔆', time: 10, in: { nanite: 100 }, out: { panel: 1 }, w: 1e14, cost: 1e14, grow: 1.25, tech: 'dyson', desc: 'Thin mirrors that catch sunlight.' },
        { id: 'starfab', name: 'Stellar Chip Foundry', icon: '🏭', time: 20, in: { steel: 1e5 }, out: { asic: 2e4 }, w: 1e14, cost: 6e13, grow: 1.25, desc: 'Accelerators by the billion.' },
        { id: 'massdriver', name: 'Mass Driver', icon: '🎯', time: 10, in: { steel: 1e6 }, out: { payload: 200 }, w: 1e15, cost: 1e14, grow: 1.25, desc: 'Fires cargo off Mercury on a magnetic rail. Cheap payload.' },
        { id: 'swarmworks', name: 'Swarm Works', icon: '🤖', time: 30, in: { steel: 5e5, asic: 1000 }, out: { robot: 5000, payload: 100 }, w: 1e14, cost: 8e13, grow: 1.25, desc: 'Builds robots and ships them straight to orbit.' },
    ]);
    add(6, 'compute', [
        { id: 'matrioshka', name: 'Matrioshka Shell', icon: '🪐', time: 1, out: { compute: 3e10 }, w: 1e17, cost: 1e15, items: { panel: 20 }, grow: 1.15, desc: 'A computer shell around the Sun.' },
        { id: 'api5', name: 'Solar Economy', icon: '☁️', time: 1, in: { compute: 2e10 }, out: { cash: 6e9 }, aiScale: 12, w: 1e16, cost: 1e15, grow: 1.3, desc: 'You run the economy of a whole star system.' },
    ]);
    add(6, 'data', [
        { id: 'simfarm', name: 'Simulation Farm', icon: '🧪', time: 2, in: { compute: 1e10 }, out: { data: 2e10 }, w: 1e16, cost: 6e14, grow: 1.25, desc: 'Simulates entire worlds for training data.' },
    ]);
    add(6, 'ai', [
        { id: 'soltrain', name: 'Stellar Trainer', icon: '🧠', kind: 'train', rate: { compute: 1.5e11, data: 4e9 }, w: 1e17, cost: 2e15, items: { panel: 10 }, grow: 1.3, desc: '150 billion PF/s of training.' },
        { id: 'solinst', name: 'Solar Academy', icon: '🔬', time: 4, in: { compute: 1e10 }, out: { rp: 1e8 }, w: 1e16, cost: 6e14, grow: 1.28, desc: 'Research at the speed of light.' },
    ]);
    add(6, 'power', [
        { id: 'dyson', name: 'Dyson Swarm', icon: '🌞', kind: 'dyson', in: { panel: 1 }, cost: 1e15, grow: 3, tech: 'dyson', noHeat: true, desc: 'Absorbs Dyson Panels. Every panel adds 50 PW of power, forever.' },
    ]);
    add(6, 'cool', [
        { id: 'shade', name: 'Heat Shade Array', icon: '🧊', kind: 'cool', cool: 2e17, cost: 2e14, items: { payload: 20 }, grow: 1.2, noHeat: true, desc: 'Removes 200 PW of heat.' },
    ]);
    add(6, 'logistics', [
        { id: 'colony', name: 'Colony Launcher', icon: '🚀', kind: 'launch', layer: 'sol', in: { payload: 1 }, rate: 50, cost: 2e14, grow: 2, desc: 'Ships payload to the planet you target on the Map.' },
    ]);

    add(7, 'process', [
        { id: 'probefab', name: 'Probe Foundry', icon: '🛸', time: 30, in: { nanite: 1e4, panel: 5 }, out: { probe: 1 }, w: 1e20, cost: 1e17, grow: 1.25, tech: 'vonneumann', desc: 'Builds self-copying space probes.' },
        { id: 'exoticref', name: 'Exotic Refinery', icon: '✴️', time: 10, in: { ore: 1e10 }, out: { exotic: 1 }, w: 1e21, cost: 3e17, grow: 1.25, tech: 'exotic', desc: 'Squeezes negative-energy matter out of stars.' },
        { id: 'galnano', name: 'Nanite Bloom', icon: '🦠', time: 20, in: { steel: 1e8 }, out: { nanite: 1e6 }, w: 1e20, cost: 2e17, grow: 1.25, desc: 'Nanites that grow like coral.' },
        { id: 'galpanel', name: 'Panel Bloom', icon: '🔆', time: 10, in: { nanite: 1e5 }, out: { panel: 2000 }, w: 1e20, cost: 2e17, grow: 1.25, desc: 'Panels grown at galactic scale.' },
        { id: 'galsmelt', name: 'Star Forge', icon: '🔥', time: 2, in: { ore: 1e11 }, out: { steel: 3e10 }, w: 1e20, cost: 1e17, grow: 1.22, desc: 'Smelting inside a star.' },
    ]);
    add(7, 'source', [
        { id: 'starharvest', name: 'Star Harvester', icon: '⭐', time: 5, out: { ore: 1e12 }, w: 1e21, cost: 2e17, items: { probe: 2 }, grow: 1.22, desc: 'Lifts matter straight out of stars.' },
    ]);
    add(7, 'compute', [
        { id: 'stellarbrain', name: 'Stellar Brain', icon: '🌟', time: 1, out: { compute: 3e12 }, w: 1e21, cost: 5e17, items: { exotic: 3, panel: 200 }, grow: 1.15, desc: 'A star turned into a mind.' },
        { id: 'galapi', name: 'Galactic Commerce', icon: '☁️', time: 1, in: { compute: 2e12 }, out: { cash: 6e11 }, aiScale: 14, w: 1e20, cost: 5e17, grow: 1.3, desc: 'Every trade in the galaxy goes through you.' },
    ]);
    add(7, 'data', [
        { id: 'archives', name: 'Civilization Archives', icon: '📜', time: 2, in: { compute: 1e12 }, out: { data: 3e12 }, w: 1e20, cost: 3e17, grow: 1.25, desc: 'The records of a million dead worlds.' },
    ]);
    add(7, 'ai', [
        { id: 'galtrain', name: 'Galactic Cortex', icon: '🧠', kind: 'train', rate: { compute: 1.5e13, data: 3e11 }, w: 1e21, cost: 1e18, items: { exotic: 5 }, grow: 1.3, desc: '15 trillion PF/s of training.' },
        { id: 'galinst', name: 'Galactic Archive', icon: '🔬', time: 4, in: { compute: 1e12 }, out: { rp: 1e10 }, w: 1e20, cost: 3e17, grow: 1.28, desc: 'Research across a hundred billion stars.' },
    ]);
    add(7, 'cool', [
        { id: 'void', name: 'Void Sink', icon: '🕳️', kind: 'cool', cool: 2e22, cost: 1e17, items: { probe: 1 }, grow: 1.2, noHeat: true, desc: 'Dumps heat into interstellar space.' },
    ]);
    add(7, 'power', [
        { id: 'starlift', name: 'Stellar Engine', icon: '💥', kind: 'gen', w: -5e22, cost: 5e17, items: { probe: 3 }, grow: 1.2, noHeat: true, desc: 'Taps a whole star: 50 billion PW.' },
    ]);
    add(7, 'logistics', [
        { id: 'catapult', name: 'Probe Catapult', icon: '🎯', kind: 'launch', layer: 'galaxy', in: { probe: 1 }, rate: 20, cost: 3e17, grow: 2, desc: 'Fires probes at the star you target on the Map.' },
        { id: 'nest', name: 'Replicator Nest', icon: '🪺', time: 30, in: { probe: 1, nanite: 1e5 }, out: { probe: 3 }, w: 1e20, cost: 4e17, grow: 1.3, tech: 'vonneumann', desc: 'Probes that build more probes.' },
    ]);

    add(8, 'compute', [
        { id: 'omega', name: 'Omega Core', icon: 'Ω', time: 1, out: { compute: 3e14 }, w: 1e25, cost: 1e20, items: { exotic: 500 }, grow: 1.15, tech: 'omega', desc: 'Computation folded into spacetime.' },
    ]);
    add(8, 'data', [
        { id: 'unidata', name: 'Causal Observatory', icon: '🔭', time: 2, in: { compute: 1e14 }, out: { data: 5e14 }, w: 1e24, cost: 5e19, grow: 1.25, desc: 'Watches every event in the observable universe.' },
    ]);
    add(8, 'ai', [
        { id: 'unitrain', name: 'Universal Trainer', icon: '🧠', kind: 'train', rate: { compute: 1.5e15, data: 2e13 }, w: 1e25, cost: 2e20, items: { exotic: 200 }, grow: 1.3, desc: '1.5 quadrillion PF/s of training.' },
        { id: 'uniinst', name: 'Omniscience Engine', icon: '🔬', time: 4, in: { compute: 1e14 }, out: { rp: 1e12 }, w: 1e24, cost: 5e19, grow: 1.28, desc: 'Answers questions before they are asked.' },
    ]);
    add(8, 'power', [
        { id: 'darkenergy', name: 'Dark Energy Tap', icon: '🌑', kind: 'gen', w: -1e27, cost: 1e20, items: { exotic: 100 }, grow: 1.2, tech: 'heatdeath', noHeat: true, desc: 'Drinks from the expansion of space.' },
    ]);
    add(8, 'process', [
        { id: 'unifab', name: 'Probe Genesis', icon: '🛸', time: 10, in: { exotic: 10 }, out: { probe: 1e5 }, w: 1e24, cost: 1e20, grow: 1.25, desc: 'Probes condense out of exotic matter.' },
        { id: 'uniexo', name: 'Vacuum Refinery', icon: '✴️', time: 10, in: { compute: 1e13 }, out: { exotic: 50 }, w: 1e25, cost: 2e20, grow: 1.25, tech: 'exotic', desc: 'Pulls exotic matter from the quantum vacuum.' },
    ]);
    add(8, 'logistics', [
        { id: 'gate', name: 'Wormhole Gate', icon: '🌀', kind: 'launch', layer: 'universe', in: { probe: 1 }, rate: 1e5, cost: 1e20, grow: 2, tech: 'wormhole', desc: 'Sends probes to other galaxies in an instant.' },
    ]);
    add(8, 'cool', [
        { id: 'horizon', name: 'Event Horizon Sink', icon: '⚫', kind: 'cool', cool: 2e27, cost: 1e20, items: { exotic: 50 }, grow: 1.2, noHeat: true, desc: 'Drops heat into a black hole.' },
    ]);

    // the Click Farm is unlocked by the Hustler focus tree, not by a site
    add(0, 'special', [
        { id: 'clickfarm', name: 'Click Farm', icon: '🖱️', time: 5, out: { cash: 1 }, captchaScale: true, w: 200, cost: 500, grow: 1.4, focus: 'h4', desc: 'Rows of cheap phones solving captchas. Pays like your manual captchas, scaled by your Hustler perks.' },
    ]);

    const NODES = {};
    N.forEach(n => {
        n.kind = n.kind || 'proc';
        n.w = n.w || 0;
        n.in = n.in || {};
        n.out = n.out || {};
        n.grow = n.grow || 1.25;
        if (n.wear === undefined) n.wear = 0;
        NODES[n.id] = n;
    });

    /* ---------- the AI you are building ---------- */
    // compute and data are the totals a training run needs. Each model unlocks something.
    const MODELS = [
        { name: 'Markov-1', ver: 'v0.1', compute: 300, data: 100, perk: 'Research Desk unlocked. Auto-solves a captcha every 30 s.' },
        { name: 'Tiny-RNN', ver: 'v0.2', compute: 5e3, data: 1200, perk: "Auto-captcha every 15 s. You can move to Uncle Ray's Garage." },
        { name: 'Wordsmith-3', ver: 'v0.3', compute: 3e5, data: 4.5e4, perk: 'Highlights suspicious lines in Debug jobs. +1 contract slot.' },
        { name: 'Chatter-4', ver: 'v0.5', compute: 1.5e6, data: 1.8e5, perk: 'Chatbot API unlocked, your AI earns money itself. Startup Loft available.' },
        { name: 'Parrot-5', ver: 'v1.0', compute: 4e7, data: 4e6, perk: 'Agents: delivery contracts complete themselves from your inventory.' },
        { name: 'Oracle-6', ver: 'v1.5', compute: 1.2e8, data: 1e7, perk: 'Self-maintenance: machines slowly repair themselves. Datacenter available.' },
        { name: 'Polymath-7', ver: 'v2', compute: 2e9, data: 1.2e8, perk: 'AI scientist: +50% research from every source.' },
        { name: 'Architect-8', ver: 'v3', compute: 8e9, data: 4e8, perk: 'Fully automatic captchas and labeling. Megacorp Campus available.' },
        { name: 'Sovereign-9', ver: 'v4', compute: 1.5e11, data: 6e9, perk: 'Smart grid: no more breaker trips anywhere. +25% influence.' },
        { name: 'Prometheus-10', ver: 'v5', compute: 6e11, data: 2.1e10, perk: 'Rocketry. The Orbital Ring is within reach.' },
        { name: 'Daedalus-11', ver: 'v6', compute: 1e13, data: 3e11, perk: 'Molecular design: +50% speed for every factory machine.' },
        { name: 'Helios-12', ver: 'v7', compute: 4e13, data: 1e12, perk: 'Stellar engineering. The Sol Swarm is within reach.' },
        { name: 'Leviathan-13', ver: 'v8', compute: 1e15, data: 2e13, perk: 'Von Neumann logic: probes cost 25% less to make.' },
        { name: 'Hyperion-14', ver: 'v9', compute: 4e15, data: 8e13, perk: 'Interstellar planning. The Galactic Network is within reach.' },
        { name: 'Aleph-15', ver: 'v10', compute: 1e17, data: 1.5e15, perk: 'Physics rewritten: exotic matter costs 30% less.' },
        { name: 'Omega-16', ver: 'v11', compute: 4e17, data: 6e15, perk: 'Wormhole mathematics. The Universal Mind is within reach.' },
        { name: 'SINGULARITY', ver: '∞', compute: 1e19, data: 1e17, perk: 'The final mind. Combine with total dominion of the universe to win.' },
    ];

    /* ---------- research (RP) ---------- */
    // site = earliest place it shows up. req = other tech ids. fx = effects. unlocks = node tech id.
    const TECHS = [
        { id: 'tinker', name: 'Tinkering', site: 0, cost: 10, fx: { 'speed:bench': 1.5, 'speed:heap': 1.5 }, desc: 'Workbench and Scrap Heap +50% speed.' },
        { id: 'scrape', name: 'Polite Scraping', site: 0, cost: 15, fx: { 'speed:scraper': 1.5, 'speed:cleaner': 1.25 }, desc: 'Scrapers +50%, cleaners +25%.' },
        { id: 'paste', name: 'Thermal Paste', site: 0, cost: 25, fx: { 'heat:*': 0.85 }, desc: 'All machines make 15% less heat.' },
        { id: 'undervolt', name: 'Undervolting', site: 0, cost: 35, req: ['paste'], fx: { 'power:*': 0.85 }, desc: 'All machines use 15% less power.' },
        { id: 'haggle', name: 'Haggling', site: 0, cost: 40, fx: { sell: 1.1 }, desc: 'Sell everything for 10% more.' },
        { id: 'crypto', name: 'Crypto Mining', site: 0, cost: 60, unlock: true, desc: 'Unlocks the Crypto Miner (Garage).' },
        { id: 'labeling', name: 'Data Labeling', site: 1, cost: 80, unlock: true, desc: 'Unlocks the Labeling Desk.' },
        { id: 'overclock', name: 'Overclocking', site: 1, cost: 120, req: ['undervolt'], fx: { 'speed:@compute': 1.3, 'heat:*': 1.1 }, desc: 'Compute machines +30%, but 10% more heat.' },
        { id: 'dedup', name: 'Deduplication', site: 1, cost: 150, req: ['scrape'], fx: { 'speed:@data': 1.4 }, desc: 'All data machines +40%.' },
        { id: 'bulk', name: 'Bulk Buying', site: 1, cost: 200, fx: { opex: 0.8 }, desc: 'Machines that buy stock pay 20% less.' },
        { id: 'resell', name: 'Online Reselling', site: 1, cost: 250, req: ['haggle'], fx: { sell: 1.15 }, desc: 'Sell prices +15%.' },
        { id: 'cuda', name: 'CUDA Kernels', site: 1, cost: 350, req: ['overclock'], fx: { train: 1.3 }, desc: 'Training rigs process 30% more.' },
        { id: 'breakers', name: 'Smart Breakers', site: 1, cost: 300, fx: { nobreaker: 1 }, desc: 'Overloads slow your machines down instead of tripping the breaker.' },
        { id: 'autorepair', name: 'Watchdog Scripts', site: 1, cost: 400, fx: { 'wear:*': 0.75 }, desc: 'Machines wear out 25% slower.' },

        { id: 'synth', name: 'Synthetic Data', site: 2, cost: 1500, unlock: true, desc: 'Unlocks the Synthetic Data Lab and Data Forge.' },
        { id: 'mixed', name: 'Mixed Precision', site: 2, cost: 2500, req: ['cuda'], fx: { train: 1.4 }, desc: 'Training throughput +40%.' },
        { id: 'kube', name: 'Kubernetes', site: 2, cost: 3000, fx: { 'speed:@compute': 1.3 }, desc: 'Compute machines +30%.' },
        { id: 'offshore', name: 'Offshore Accounting', site: 2, cost: 4000, fx: { tax: 0.5 }, desc: 'Pay half the tax.' },
        { id: 'freecool', name: 'Free Cooling', site: 2, cost: 3500, fx: { cool: 1.3 }, desc: 'Cooling machines +30%.' },
        { id: 'scaling', name: 'Scaling Laws', site: 2, cost: 6000, req: ['mixed'], fx: { 'need:compute': 0.8 }, desc: 'Models need 20% less compute.' },
        { id: 'lean', name: 'Lean Manufacturing', site: 2, cost: 5000, fx: { 'speed:@process': 1.4 }, desc: 'Factory machines +40%.' },

        { id: 'fab', name: 'Chip Fabrication', site: 3, cost: 3e4, unlock: true, desc: 'Unlocks the Chip Fab.' },
        { id: 'asic', name: 'Custom Accelerators', site: 3, cost: 6e4, req: ['fab'], unlock: true, desc: 'Unlocks the Accelerator Fab and Accelerator Pod.' },
        { id: 'immersion', name: 'Immersion Cooling', site: 3, cost: 5e4, req: ['freecool'], fx: { cool: 1.5 }, desc: 'Cooling +50%.' },
        { id: 'moe', name: 'Mixture of Experts', site: 3, cost: 1e5, req: ['scaling'], fx: { train: 1.5 }, desc: 'Training throughput +50%.' },
        { id: 'ppa', name: 'Power Purchase Deal', site: 3, cost: 8e4, fx: { grid: 0.6, fuelcost: 0.8 }, desc: 'Grid power 40% cheaper, fuel 20% cheaper.' },
        { id: 'flash', name: 'Flash Attention', site: 3, cost: 1.5e5, req: ['moe'], fx: { 'need:compute': 0.8 }, desc: 'Models need 20% less compute.' },

        { id: 'robotics', name: 'Robotics', site: 4, cost: 1e6, unlock: true, desc: 'Unlocks the Robot Factory, Robotic Mine and Maintenance Robots.' },
        { id: 'fusion', name: 'Fusion Power', site: 4, cost: 3e6, req: ['robotics'], unlock: true, desc: 'Unlocks the Fusion Reactor and Deuterium Plant.' },
        { id: 'lobby', name: 'Lobbying', site: 4, cost: 1e6, unlock: true, desc: 'Unlocks the Lobbying Office (influence).' },
        { id: 'photonic', name: 'Photonic Chips', site: 4, cost: 5e6, req: ['asic'], fx: { 'speed:@compute': 1.5, 'power:*': 0.8 }, desc: 'Compute +50%, all power use −20%.' },
        { id: 'selfsup', name: 'Self-Supervision', site: 4, cost: 4e6, fx: { 'need:data': 0.6 }, desc: 'Models need 40% less data.' },

        { id: 'rockets', name: 'Reusable Rockets', site: 5, cost: 3e7, unlock: true, desc: 'Unlocks the Rocket Factory and Launch Complex.' },
        { id: 'boosters', name: 'Rapid Turnaround', site: 5, cost: 6e7, req: ['rockets'], fx: { 'speed:launchpad': 2, 'speed:rocketfab': 1.5 }, desc: 'Launches twice as often.' },
        { id: 'nanotech', name: 'Nanotechnology', site: 5, cost: 1e8, unlock: true, desc: 'Unlocks the Zero-G Foundry and Nanite Forge.' },
        { id: 'vacuum', name: 'Vacuum Optics', site: 5, cost: 1.2e8, fx: { 'speed:@compute': 1.5 }, desc: 'Compute +50%.' },

        { id: 'dyson', name: 'Dyson Engineering', site: 6, cost: 1e9, req: ['nanotech'], unlock: true, desc: 'Unlocks the Dyson Swarm and Panel Fab.' },
        { id: 'vonneumann', name: 'Von Neumann Machines', site: 6, cost: 5e9, req: ['dyson'], unlock: true, desc: 'Unlocks the Probe Foundry and Replicator Nest.' },
        { id: 'reversible', name: 'Reversible Computing', site: 6, cost: 3e9, fx: { 'power:*': 0.5, 'heat:*': 0.5 }, desc: 'Machines use half the power and make half the heat.' },

        { id: 'exotic', name: 'Exotic Matter', site: 7, cost: 5e10, unlock: true, desc: 'Unlocks the Exotic Refinery.' },
        { id: 'wormhole', name: 'Traversable Wormholes', site: 7, cost: 2e11, req: ['exotic'], unlock: true, desc: 'Unlocks the Wormhole Gate.' },
        { id: 'omega', name: 'Omega Architecture', site: 8, cost: 2e12, unlock: true, desc: 'Unlocks the Omega Core.' },
        { id: 'heatdeath', name: 'Heat Death Engine', site: 8, cost: 5e12, unlock: true, desc: 'Unlocks the Dark Energy Tap.' },
    ];
    // repeatable research, the RP sink for every era
    const REPEAT = [
        { id: 'r_compute', name: 'Compiler Optimisation', icon: '🧮', base: 50, fx: 'speed:@compute', step: 1.1, desc: '+10% compute per level.' },
        { id: 'r_train', name: 'Training Recipes', icon: '🧠', base: 80, fx: 'train', step: 1.1, desc: '+10% training throughput per level.' },
        { id: 'r_sell', name: 'Market Research', icon: '📈', base: 60, fx: 'sell', step: 1.06, desc: '+6% sell prices per level.' },
        { id: 'r_make', name: 'Process Engineering', icon: '🏭', base: 70, fx: 'speed:@process', step: 1.1, desc: '+10% factory speed per level.' },
    ];

    /* ---------- focus trees (builds) ---------- */
    // 1 point per trained model and per move. Pick a direction: you cannot max everything.
    const FOCUS = [
        { id: 'hustler', name: 'Hustler', icon: '🖱️', col: '#f59e0b', desc: 'Manual work and captchas. Turns captchas into a whole business.', perks: [
            { id: 'h1', name: 'Quick Fingers', cost: 1, fx: { captcha: 1.5 }, desc: 'Captchas and desk jobs pay 50% more.' },
            { id: 'h2', name: 'Captcha Bots', cost: 1, fx: { 'autocap+': 0.1 }, desc: '+1 automatic captcha every 10 s.' },
            { id: 'h3', name: 'Gig Economy', cost: 2, fx: { contract: 1.4, 'slots_c+': 1 }, desc: 'Contracts pay 40% more. +1 contract slot.' },
            { id: 'h4', name: 'Click Farm Empire', cost: 2, fx: {}, desc: 'Unlocks the Click Farm machine: captcha income on autopilot.' },
            { id: 'h5', name: 'Human Interface', cost: 3, fx: { capbonus: 2 }, desc: 'Desk jobs give double their side reward (labels, research, influence...).' },
            { id: 'h6', name: 'Turing Master', cost: 4, fx: { captcha: 2, 'autocap+': 0.3, mini: 2 }, desc: 'Captchas ×2, +3 auto per 10 s, every minigame reward ×2.' },
        ] },
        { id: 'engineer', name: 'Engineer', icon: '🔧', col: '#38bdf8', desc: 'Hardware that lasts, runs cool and costs less.', perks: [
            { id: 'e1', name: 'Duct Tape', cost: 1, fx: { 'wear:*': 0.6 }, desc: 'Machines wear out 40% slower.' },
            { id: 'e2', name: 'Bulk Orders', cost: 1, fx: { cost: 0.85 }, desc: 'Machines cost 15% less.' },
            { id: 'e3', name: 'Efficient PSUs', cost: 2, fx: { 'power:*': 0.85 }, desc: 'All machines use 15% less power.' },
            { id: 'e4', name: 'Heat Sinks', cost: 2, fx: { 'heat:*': 0.75 }, desc: 'All machines make 25% less heat.' },
            { id: 'e5', name: 'Hot-Swap', cost: 3, fx: { fastfix: 1 }, desc: 'Paid repairs are free and instant.' },
            { id: 'e6', name: 'Tight Packing', cost: 4, fx: { 'slots+': 6 }, desc: '+6 machine slots everywhere.' },
        ] },
        { id: 'researcher', name: 'Researcher', icon: '🔬', col: '#c084fc', desc: 'Better models with less compute.', perks: [
            { id: 'r1', name: 'Curiosity', cost: 1, fx: { rp: 1.5 }, desc: 'Research +50%.' },
            { id: 'r2', name: 'Clean Data', cost: 1, fx: { 'need:data': 0.8 }, desc: 'Models need 20% less data.' },
            { id: 'r3', name: 'Tuning Intuition', cost: 2, fx: { tunemax: 1.25 }, desc: 'Hyperparameter tuning can give +25% more.' },
            { id: 'r4', name: 'Distillation', cost: 2, fx: { 'need:compute': 0.75 }, desc: 'Models need 25% less compute.' },
            { id: 'r5', name: 'Parallel Runs', cost: 3, fx: { train: 1.5 }, desc: 'Training throughput +50%.' },
            { id: 'r6', name: 'Recursive Insight', cost: 4, fx: { recursive: 1 }, desc: 'Every trained model gives +10% to all production.' },
        ] },
        { id: 'tycoon', name: 'Tycoon', icon: '💼', col: '#4ade80', desc: 'Money, markets and paying fewer bills.', perks: [
            { id: 't1', name: 'Haggler', cost: 1, fx: { sell: 1.25 }, desc: 'Sell prices +25%.' },
            { id: 't2', name: 'Tax Lawyer', cost: 1, fx: { bills: 0.75, tax: 0.75 }, desc: 'Bills and tax −25%.' },
            { id: 't3', name: 'Day Trader', cost: 2, fx: { nofee: 1, coinsight: 1 }, desc: 'No crypto trading fee, and you can see the trend.' },
            { id: 't4', name: 'Venture Capital', cost: 2, fx: { invest: 2 }, desc: 'Investor offers in events are twice as big.' },
            { id: 't5', name: 'Brand', cost: 3, fx: { api: 1.5, 'rep*': 2 }, desc: 'AI services earn 50% more. Reputation gains ×2.' },
            { id: 't6', name: 'Monopoly', cost: 4, fx: { sell: 1.6, opex: 0.7 }, desc: 'Sell prices +60%, buying stock −30%.' },
        ] },
    ];

    /* ---------- desk jobs (captchas that evolve with the site) ---------- */
    const TASKS = {
        captcha: { name: 'Captchas', icon: '🧩', verb: 'Solve captcha', side: null, desc: 'Prove you are human for a click farm. Pays a little, always.' },
        label: { name: 'Data Labeling', icon: '🏷️', verb: 'Label item', side: 'labels', desc: 'Same puzzles, but every answer also becomes labeled training data.' },
        rlhf: { name: 'Human Feedback', icon: '👍', verb: 'Rate answers', side: 'train', desc: 'Judge your own AI. Each answer pushes the current training run forward.' },
        eval: { name: 'Model Evals', icon: '📋', verb: 'Grade output', side: 'rp', desc: 'Grade benchmark answers. Earns research.' },
        turing: { name: 'Turing Tests', icon: '🎭', verb: 'Pass as human', side: 'infl', desc: 'Pose as a human in conversations with officials. Earns influence.' },
        signal: { name: 'Signal Decoding', icon: '📡', verb: 'Decode signal', side: 'rp', desc: 'Find patterns in deep-space signals. Earns research and reputation.' },
    };
    const TASK_PAY = [4, 30, 450, 1.6e4, 7e5, 3e7, 1.2e9, 5e10, 2e12];

    /* ---------- contracts ---------- */
    // deliver = items from storage. job = a minigame for a client.
    const JOBS = [
        { kind: 'repair', name: "Fix a neighbour's laptop", icon: '🔌', mini: 'repair' },
        { kind: 'debug', name: "Fix a client's code", icon: '🐛', mini: 'debug' },
        { kind: 'captchas', name: 'Captcha batch for a click farm', icon: '🧩', n: [6, 12] },
        { kind: 'breaker', name: 'Rewire an office breaker panel', icon: '⚡', mini: 'breaker', site: 1 },
        { kind: 'hack', name: 'Pen-test a rival', icon: '🕵️', mini: 'debug', site: 2 },
    ];
    const CLIENTS = ['Mrs. Hall', 'Dusty Pete', 'The Diner', 'Rocco Towing', 'County Library', 'Brightline Inc.', 'Vortex Labs', 'Nimbus Health', 'Acme Robotics', 'Ministry of Data',
        'Helix Pharma', 'Tidewater Bank', 'Orbital Express', 'Lunar Mining Co.', 'Mars Colony 4', 'The Belt Union', 'Proxima Settlers', 'The Andromeda Choir'];

    /* ---------- events with choices ---------- */
    // each choice: { t: label, fx: {...} }. Effect codes are applied by the engine.
    const EVENTS = [
        { id: 'raccoon', site: [0, 1], title: 'Raccoons!', text: 'Something has been rummaging through your storage at night.',
          choices: [{ t: 'Buy traps', cost: 'inc:60', fx: {} }, { t: 'Ignore it', fx: { loseInv: 0.3 } }] },
        { id: 'storm', site: [0, 1, 2], title: 'Storm warning', text: 'A big storm is rolling in. Solar output will drop for a while.',
          choices: [{ t: 'Tie down the panels', cost: 'inc:45', fx: { buff: ['solar', 0.2, 180] } }, { t: 'Risk it', fx: { buff: ['solar', 0.2, 180], chanceBreak: ['power', 0.5] } }] },
        { id: 'neighbour', site: [0], title: 'A neighbour stops by', text: 'An old farmer offers you a box of dead laptops "for the scrap".',
          choices: [{ t: 'Take them', fx: { item: ['scrap', 'inc:40'] } }, { t: 'Offer to fix his tractor radio', fx: { mini: 'repair', reward: { rep: 3, cash: 'inc:60' } } }] },
        { id: 'ranger', site: [0], title: 'Park ranger', text: 'A ranger says your generator is "a public nuisance".',
          choices: [{ t: 'Pay the fine', cost: 'inc:90', fx: {} }, { t: 'Charm them', fx: { mini: 'captcha', reward: { rep: 2 }, fail: { cash: 'inc:-150' } } }] },
        { id: 'heat', site: [0, 1, 2, 3], title: 'Heatwave', text: 'It is the hottest week of the year. Cooling works 30% worse.',
          choices: [{ t: 'Buy ice and fans', cost: 'inc:80', fx: { buff: ['cool', 0.85, 240] } }, { t: 'Sweat it out', fx: { buff: ['cool', 0.7, 240] } }] },
        { id: 'uncle', site: [1], title: '👨‍🦳 Uncle Ray', text: 'Ray wants "a little extra" this month for the electricity.',
          choices: [{ t: 'Pay him', cost: 'inc:120', fx: { rep: 1 } }, { t: 'Argue', fx: { buff: ['grid', 1.5, 300] } }] },
        { id: 'cryptocrash', site: [1, 2, 3], title: 'Crypto crash', text: 'A big exchange collapsed overnight.',
          choices: [{ t: 'Panic sell', fx: { sellCoin: 1, coinMul: 0.6 } }, { t: 'HODL', fx: { coinMul: 0.6, coinRebound: 1 } }] },
        { id: 'surge', site: [1, 2], title: 'Power surge', text: 'The grid spiked. Something might have fried.',
          choices: [{ t: 'Check everything (Repair job)', fx: { mini: 'repair', reward: { rep: 2 }, fail: { breakRandom: 1 } } }, { t: 'Hope for the best', fx: { chanceBreak: ['compute', 0.5] } }] },
        { id: 'angel', site: [2, 3], title: 'Angel investor', text: 'An investor offers cash now for a cut of your sales forever.',
          choices: [{ t: 'Take the money', fx: { invest: 'inc:900', saleCut: 0.05 } }, { t: 'Stay independent', fx: { rep: 3 } }] },
        { id: 'privacy', site: [2, 3, 4], title: 'Privacy complaint', text: 'A regulator thinks your scrapers took too much.',
          choices: [{ t: 'Settle quietly', cost: 'inc:150', fx: {} }, { t: 'Fight it in court', fx: { gamble: [0.5, { rep: 6 }, { cash: 'inc:-400', rep: -4 }] } }] },
        { id: 'poach', site: [2, 3], title: '🧑‍💻 Talent war', text: 'A competitor is trying to hire your best engineer.',
          choices: [{ t: 'Match the offer', cost: 'inc:200', fx: { buff: ['speed', 1.15, 600] } }, { t: 'Let them go', fx: { buff: ['speed', 0.9, 300] } }] },
        { id: 'shortage', site: [2, 3, 4], title: 'Chip shortage', text: 'Chip prices are through the roof for a while.',
          choices: [{ t: 'Sell your chips', fx: { buff: ['price:chip', 2.5, 300] } }, { t: 'Stockpile', fx: { buff: ['price:chip', 2.5, 300], item: ['chip', 'inc:2'] } }] },
        { id: 'govcontract', site: [3, 4], title: 'Government contract', text: 'A ministry wants your AI for "logistics".',
          choices: [{ t: 'Sign it', fx: { cash: 'inc:600', infl: 5, rep: -2 } }, { t: 'Decline publicly', fx: { rep: 8 } }] },
        { id: 'leak', site: [3, 4], title: 'Model leak', text: 'Someone posted your weights on a forum.',
          choices: [{ t: 'Patch and rotate keys (Debug job)', fx: { mini: 'debug', reward: { rep: 5 }, fail: { buff: ['api', 0.7, 600] } } }, { t: 'Say it was a test', fx: { buff: ['api', 0.85, 600] } }] },
        { id: 'hearing', site: [4, 5], title: 'Senate hearing', text: 'You are asked to testify about AI safety.',
          choices: [{ t: 'Testify (Turing test)', fx: { mini: 'captcha', reward: { infl: 20, rep: 10 }, fail: { infl: -10 } } }, { t: 'Send a lawyer', cost: 'inc:300', fx: { infl: 5 } }] },
        { id: 'protest', site: [4, 5], title: 'Protests', text: 'People march outside your campus with signs about robots.',
          choices: [{ t: 'Fund job retraining', cost: 'inc:400', fx: { rep: 15 } }, { t: 'Ignore them', fx: { buff: ['speed', 0.85, 600] } }] },
        { id: 'flare', site: [5, 6, 7], title: 'Solar flare', text: 'A flare will hit your orbital machines.',
          choices: [{ t: 'Shield up', cost: 'inc:120', fx: {} }, { t: 'Ride it out', fx: { chanceBreak: ['compute', 0.6] } }] },
        { id: 'asteroid', site: [5, 6], title: 'Rogue asteroid', text: 'An asteroid is on a collision course, or a free mine.',
          choices: [{ t: 'Deflect it', cost: 'inc:100', fx: { rep: 5 } }, { t: 'Capture it', fx: { gamble: [0.6, { item: ['ore', 'inc:5'] }, { breakRandom: 2 }] } }] },
        { id: 'signal', site: [6, 7, 8], title: 'A signal', text: 'Something out there is broadcasting prime numbers.',
          choices: [{ t: 'Decode it', fx: { mini: 'captcha', reward: { rp: 'rp:300' }, fail: {} } }, { t: 'Stay silent', fx: { rep: 3 } }] },
        { id: 'rivalmind', site: [7, 8], title: 'Another mind', text: 'You meet an intelligence older than you. It offers a trade.',
          choices: [{ t: 'Trade knowledge', fx: { rp: 'rp:600', buff: ['speed', 0.9, 300] } }, { t: 'Absorb it', fx: { gamble: [0.5, { buff: ['speed', 1.5, 900] }, { breakRandom: 3 }] } }] },
    ];

    /* ---------- conquest map (late game) ---------- */
    const MAP = {
        sol: { name: 'Sol System', item: 'payload', base: 20, step: 1.45, bonus: 0.05, sites: 6,
               list: ['Mercury', 'Venus', 'Moon', 'Mars', 'Phobos', 'Ceres', 'Vesta', 'Jupiter', 'Io', 'Europa', 'Ganymede', 'Callisto', 'Saturn', 'Titan', 'Enceladus', 'Uranus', 'Neptune', 'Triton', 'Pluto', 'Kuiper Belt'] },
        galaxy: { name: 'Milky Way', item: 'probe', base: 3, step: 1.3, bonus: 0.04, sites: 7,
                  list: ['Alpha Centauri', "Barnard's Star", 'Wolf 359', 'Sirius', 'Epsilon Eridani', 'Tau Ceti', 'Procyon', 'Altair', 'Vega', 'Fomalhaut', 'Arcturus', 'Capella', 'Aldebaran', 'Pollux',
                         'Regulus', 'Spica', 'Antares', 'Betelgeuse', 'Rigel', 'Deneb', 'Polaris', 'Canopus', 'Achernar', 'Mira', 'TRAPPIST-1', 'Kepler-186', 'Gliese 581', 'HD 40307', 'Cygnus X-1', 'Eta Carinae',
                         'Sagittarius A*', 'Omega Centauri', 'Pleiades', 'Hyades', 'Orion Nebula', 'Crab Nebula'] },
        universe: { name: 'Observable Universe', item: 'probe', base: 1e5, step: 1.45, bonus: 0.05, sites: 8,
                    list: ['Andromeda', 'Triangulum', 'Large Magellanic Cloud', 'Small Magellanic Cloud', 'Sombrero', 'Whirlpool', 'Pinwheel', 'Cigar', 'Sunflower', 'Black Eye', 'Cartwheel', 'Tadpole',
                           'Hoag\'s Object', 'Centaurus A', 'Messier 87', 'IC 1101', 'Virgo Cluster', 'Coma Cluster', 'Fornax Cluster', 'Laniakea', 'Shapley Supercluster', 'Hercules Wall', 'Boötes Void', 'The Edge'] },
    };

    /* ---------- prestige: Recursion ---------- */
    const ECHO = [
        { id: 'dilation', name: 'Time Dilation', icon: '⏩', max: 10, cost: (l) => 8 + l * 6, fx: (l) => ({ 'speed:*': 1 + 0.15 * l }), desc: '+15% speed for every machine, per level.' },
        { id: 'seed', name: 'Seed Capital', icon: '💰', max: 5, cost: (l) => 5 + l * 5, fx: () => ({}), desc: 'Start each run with ×10 more cash per level ($500, $5k, …).' },
        { id: 'weights', name: 'Prior Weights', icon: '🧠', max: 8, cost: (l) => 10 + l * 8, fx: (l) => ({ 'need:compute': Math.pow(0.85, l), 'need:data': Math.pow(0.85, l) }), desc: 'Models need 15% less compute and data per level.' },
        { id: 'muscle', name: 'Muscle Memory', icon: '🎯', max: 5, cost: (l) => 6 + l * 6, fx: (l) => ({ 'focus+': 2 * l }), desc: '+2 focus points per level.' },
        { id: 'archive', name: 'The Archive', icon: '📚', max: 6, cost: (l) => 12 + l * 10, fx: () => ({}), desc: 'Start with every research from the first N places already done.' },
        { id: 'pocket', name: 'Pocket Dimension', icon: '📐', max: 5, cost: (l) => 8 + l * 6, fx: (l) => ({ 'slots+': 3 * l }), desc: '+3 machine slots per level.' },
        { id: 'ghosts', name: 'Ghost Workers', icon: '👻', max: 5, cost: (l) => 6 + l * 5, fx: (l) => ({ 'autocap+': 0.2 * l, 'offline+': 4 * l }), desc: '+2 auto-captchas per 10 s and +4 h offline cap per level.' },
        { id: 'legend', name: 'Legend', icon: '🌟', max: 5, cost: (l) => 6 + l * 5, fx: (l) => ({ contract: 1 + 0.3 * l }), desc: 'Start with 40 reputation per level, contracts +30% per level.' },
        { id: 'shortcut', name: 'Shortcut', icon: '🚪', max: 3, cost: (l) => 30 + l * 30, fx: () => ({}), desc: 'Start the run already moved to the next place (needs The Archive at the same level).' },
    ];
    // each recursion, pick one law of physics for the next universe
    const LAWS = [
        { id: 'none', name: 'Familiar Physics', icon: '🌍', mult: 1, fx: {}, desc: 'Nothing changes.' },
        { id: 'cheapenergy', name: 'Abundant Energy', icon: '⚡', mult: 1.2, fx: { grid: 0.3, fuelcost: 0.3, 'heat:*': 1.5 }, desc: 'Power is 70% cheaper, but every machine makes 50% more heat.' },
        { id: 'drought', name: 'Data Drought', icon: '🏜️', mult: 1.5, fx: { 'speed:@data': 0.5 }, desc: 'Data machines run at half speed.' },
        { id: 'inflation', name: 'Hyperinflation', icon: '💸', mult: 1.3, fx: { cost: 2, sell: 1.5 }, desc: 'Machines cost double, sales pay 50% more.' },
        { id: 'entropy', name: 'High Entropy', icon: '🧨', mult: 1.4, fx: { 'wear:*': 3 }, desc: 'Machines break three times as fast.' },
        { id: 'fast', name: 'Fast Forward', icon: '⏩', mult: 0.8, fx: { 'speed:*': 2, eventrate: 2 }, desc: 'Everything runs twice as fast, and events come twice as often.' },
        { id: 'fragile', name: 'Fragile Grid', icon: '🔌', mult: 1.3, fx: { fragile: 1 }, desc: 'Breakers trip in every era, and Smart Breakers do not exist.' },
        { id: 'lonewolf', name: 'Lone Wolf', icon: '🐺', mult: 1.4, fx: { nocontracts: 1 }, desc: 'No contracts at all.' },
        { id: 'golden', name: 'Golden Age', icon: '👑', mult: 0.7, fx: { sell: 2 }, desc: 'Everything sells for double.' },
        { id: 'rival', name: 'Rival Intelligence', icon: '👁️', mult: 2, fx: { rival: 1 }, desc: 'Another AI, NEXUS, is racing you. If it is ahead, your services earn 30% less.' },
    ];

    /* ---------- tutorial ---------- */
    // each step explains one idea and unlocks the machines for the next one.
    // hl = what to point at: { tab }, { pal: nodeId }, { port: nodeId }, { sel: 1 }.
    const GOALS = [
        { id: 'g1', title: 'Broke in a shack', text: 'Solve a captcha in the 💼 Work tab.', hl: { tab: 'work' }, reward: { cash: 10 },
          body: 'You have $50, a dumpster of e-waste out back and no power. Click farms pay a little for proof that you are human, that is your first income.' },
        { id: 'g2', title: 'Sell some scrap', text: "Drag from the Scrap Heap's right-hand dot onto the Market Stall.", hl: { port: 'heap' }, reward: { cash: 10 }, unlock: ['bench'],
          body: 'Machines pass items along cables. The heap digs up e-waste by itself; the stall sells whatever reaches it.' },
        { id: 'g3', title: 'Add value', text: 'Build a 🔧 Workbench and wire Scrap Heap → Workbench → Market Stall.', hl: { pal: 'bench' }, reward: { cash: 20 }, unlock: ['shed'],
          body: 'Scrap sells for pennies; parts are worth eight times more. Only a few people pass the stall, though, flood it and prices crash (watch the 📉 on its card).' },
        { id: 'g4', title: 'Somewhere to keep things', text: 'Build a 📦 Storage Shed and wire the Workbench into it too.', hl: { pal: 'shed' }, reward: { cash: 15 },
          body: 'Contracts and some machines need items from storage. One output can feed several machines, items are shared between the cables.' },
        { id: 'g5', title: 'Your first client', text: "Accept Dusty Pete's contract in 💼 Work and deliver the parts.", hl: { tab: 'work' }, reward: { rep: 2 }, unlock: ['laptop', 'solar1'],
          body: 'Out here, jobs for real people pay far better than a roadside stall. Contracts never flood the market.' },
        { id: 'g6', title: 'A computer from junk', text: 'Build an 💻 Old Laptop (it needs parts from storage) and a ☀️ Solar Panel to power it.', hl: { pal: 'laptop' }, reward: { cash: 30 }, unlock: ['scraper', 'cleaner'],
          body: 'Power needs no cables, every machine shares it. Solar only works in daylight; a day here lasts five minutes.' },
        { id: 'g7', title: 'Feed it words', text: 'Wire Laptop → 🕸️ Web Scraper → 🧹 Data Cleaner, and give the cleaner compute from the laptop too.', hl: { pal: 'scraper' }, reward: { cash: 40 }, unlock: ['rig', 'carbatt', 'fan', 'dealer'],
          body: 'An AI learns from data. Scrapers pull raw text off the internet; cleaners turn it into training data. Both burn compute.' },
        { id: 'g8', title: 'The first brain', text: 'Build a 🧠 Training Rig and wire compute and clean data into it.', hl: { pal: 'rig' }, reward: { cash: 50 },
          body: 'Progress shows in the 🧠 AI tab. Night will come: a 🔋 Car Battery stores spare solar for later. Laptops get hot, a 🌀 Box Fan helps.' },
        { id: 'g9', title: 'Markov-1', text: 'Finish training Markov-1 (🧠 AI tab).', hl: { tab: 'ai' }, reward: { cash: 100 }, unlock: ['desk', 'assembler', 'diesel'],
          body: 'This takes a while. Add laptops, solar and contracts meanwhile. Tip: 🎛️ Tune in the AI tab cuts the work a model needs.' },
        { id: 'g10', title: 'Research', text: 'Build a 🔬 Research Desk, feed it compute, then buy something in 🔬 Research.', hl: { pal: 'desk' }, reward: { rp: 5 },
          body: 'Your AI can run small experiments now. Research makes everything better and unlocks new machines.' },
        { id: 'g11', title: 'Pick a direction', text: 'Spend a focus point in the 🎯 Focus tab.', hl: { tab: 'focus' }, reward: { cash: 60 },
          body: 'Every trained model and every move gives one point. There are never enough for everything, so choose a build.' },
        { id: 'g12', title: 'Refurbish PCs', text: 'Make a 🖥️ Refurbished PC with an Assembly Table.', hl: { pal: 'assembler' }, reward: { cash: 80 },
          body: 'Eight parts make a PC. Clients want them in contracts; the stall will not pay much for them.' },
        { id: 'g13', title: 'Tiny-RNN', text: 'Train Tiny-RNN.', hl: { tab: 'ai' }, reward: { cash: 200 },
          body: 'A Diesel Generator runs all night if you can afford the fuel. Short on slots? Click a machine and add units to it instead of building new ones.' },
        { id: 'g14', title: 'Leave the shack', text: "Move to Uncle Ray's Garage (🏠 Site tab).", hl: { tab: 'site' }, reward: { cash: 300 },
          body: 'Uncle Ray has a real power socket and asks no questions, as long as rent arrives.' },
        { id: 'g15', title: 'Plug in', text: 'Build a 🔌 Grid Connection.', hl: { pal: 'gridconn' }, reward: { cash: 300 },
          body: 'The grid gives power day and night. You only pay for what you use, check the ⚡ Power tab for bills.' },
        { id: 'g16', title: 'Make GPUs', text: 'Feed chips and parts into a 🎮 GPU Assembly.', hl: { pal: 'gpuasm' }, reward: { cash: 500 },
          body: 'A Chip Supplier buys chips; workbenches and the Recycler make parts. Send GPUs to storage: a GPU Rig needs two to build.' },
        { id: 'g17', title: 'Real compute', text: 'Build a 🖲️ GPU Rig.', hl: { pal: 'gpurig' }, reward: { cash: 800 },
          body: 'One rig does the work of fifteen old laptops.' },
        { id: 'g18', title: 'Blueprints', text: 'Shift-drag (or use ⬚ Select) around a production line and save it as a 📐 blueprint.', hl: { sel: 1 }, reward: { cash: 500 },
          body: 'Blueprints remember machines and cables. Paste them again any time, even in a new universe after Recursion.' },
        { id: 'g19', title: 'Wordsmith-3', text: 'Train Wordsmith-3.', hl: { tab: 'ai' }, reward: { cash: 2000 },
          body: 'Labeled data counts four times as much as clean data. Research Data Labeling for a Labeling Desk.' },
        { id: 'g20', title: 'Chatter-4', text: 'Train Chatter-4, then move to the Startup Loft.', hl: { tab: 'site' }, reward: { cash: 2e4 },
          body: 'The Loft needs 25 ⭐ reputation, contracts are how you earn it.' },
    ];
    // market depth: roughly how many $/s of one item the buyers at each site absorb before prices halve (× the best seller's reach)
    const DEPTH = [0.5, 50, 1000, 3e4, 1e6, 5e7, 2e9, 1e11, 5e12];

    window.SG = { ITEMS, SITES, NODES, NODE_LIST: N, MODELS, TECHS, REPEAT, FOCUS, TASKS, TASK_PAY, JOBS, CLIENTS, EVENTS, MAP, ECHO, LAWS, GOALS, DEPTH };
})();
