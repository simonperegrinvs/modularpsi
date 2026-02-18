#!/bin/bash
# Link references to nodes using actual ref IDs
set -e

CLI="npx tsx src/cli/index.ts"
F="-f $HOME/data/modularpsi/psi-literature.json"
FMT="--format quiet"

link() {
  $CLI $F $FMT ref link "$1" "$2"
}

# Actual ref IDs (in creation order)
R1="ref-1771410246477"   # Shannon (1948)
R2="ref-1771410246735"   # Aharonov et al. (1964)
R3="ref-1771410246994"   # Wootters & Zurek (1982)
R4="ref-1771410247255"   # Eberhard & Ross (1989)
R5="ref-1771410247521"   # Hensen et al. (2015)
R6="ref-1771410247786"   # Penrose (2014)
R7="ref-1771410248048"   # Bohm (1980)
R8="ref-1771410248311"   # Bousso (2002)
R9="ref-1771410248572"   # GW170817 / Abbott et al. (2017)
R10="ref-1771410248832"  # Honorton et al. (1990)
R11="ref-1771410249092"  # Storm et al. (2010)
R12="ref-1771410249356"  # Hyman (2010)
R13="ref-1771410249620"  # Tressoldi et al. (2024)
R14="ref-1771410249882"  # Bem (2011)
R15="ref-1771410250145"  # Galak et al. (2012)
R16="ref-1771410250407"  # Mossbridge et al. (2012)
R17="ref-1771410250667"  # Wagenmakers et al. (2011)
R18="ref-1771410250930"  # Schmidt (1976)
R19="ref-1771410251195"  # Bosch et al. (2006)
R20="ref-1771410251457"  # Parnia et al. (2014)
R21="ref-1771410251725"  # Parnia et al. (2023)
R22="ref-1771410251986"  # Hameroff & Penrose (2014)
R23="ref-1771410252250"  # Kalra et al. (2023)
R24="ref-1771410252513"  # Khan et al. (2024)
R25="ref-1771410252775"  # Donadi et al. (2021)
R26="ref-1771410253037"  # Irwin (1985)
R27="ref-1771410253299"  # Braud (1975)
R28="ref-1771410253562"  # Stokes (1987)
R29="ref-1771410253824"  # Radin (1997)
R30="ref-1771410254087"  # Cardena (2018)
R31="ref-1771410254350"  # Blackmore (1986)
R32="ref-1771410254610"  # Alcock (2003)
R33="ref-1771410254875"  # Wiseman & Milton (1999)
R34="ref-1771410255138"  # Lesser & Paisner (1985)
R35="ref-1771410255400"  # Schumaker (1990)
R36="ref-1771410255664"  # Stanford (1974)
R37="ref-1771410255937"  # Nelson et al. (2002)
R38="ref-1771410256206"  # Bem & Honorton (1994)
R39="ref-1771410256476"  # Utts (1996)
R40="ref-1771410256738"  # Radin (2006)

echo "=== Linking References to Nodes ==="

# Foundational Physics
link $R1 P18   # Shannon -> Quantum Non-Locality (info theory context)
link $R2 P24   # Aharonov -> TSVF
link $R2 P25   # Aharonov -> Time-Symmetric QM for Precognition
link $R3 P18   # No-cloning -> Quantum Non-Locality
link $R4 P19   # Eberhard -> No-Signaling Constraint
link $R5 P18   # Hensen Bell test -> Quantum Non-Locality
link $R5 P76   # Hensen -> Loophole-Free Bell Tests
link $R6 P35   # Penrose -> Orch-OR
link $R6 P78   # Penrose -> Gravity-Related Collapse
link $R7 P21   # Bohm -> Implicate Order
link $R8 P22   # Bousso -> Holographic Principle
link $R9 P30   # GW170817 -> Gravity Carrier (falsified)

# Ganzfeld / ESP
link $R10 P6   # Honorton autoganzfeld -> Ganzfeld Evidence
link $R10 P67  # Honorton -> Autoganzfeld Protocol
link $R11 P6   # Storm meta -> Ganzfeld Evidence
link $R11 P68  # Storm -> Ganzfeld Meta-Analyses
link $R12 P6   # Hyman critique -> Ganzfeld Evidence
link $R12 P68  # Hyman -> Ganzfeld Meta-Analyses
link $R13 P6   # Tressoldi registered report -> Ganzfeld Evidence
link $R13 P68  # Tressoldi -> Ganzfeld Meta-Analyses

# Precognition / Presentiment
link $R14 P10  # Bem -> Bem Precognition
link $R15 P61  # Galak -> Bem Replication Failures
link $R15 P10  # Galak -> Bem Precognition (shows failure)
link $R16 P11  # Mossbridge -> Presentiment
link $R16 P71  # Mossbridge -> Electrodermal Presentiment
link $R17 P10  # Wagenmakers -> Bem Precognition (critique)

# PK / RNG
link $R18 P74  # Schmidt -> Schmidt RNG Experiments
link $R18 P32  # Schmidt -> Observational Theory
link $R19 P14  # Bosch -> Micro-PK
link $R19 P50  # Bosch -> Publication Bias (shows pattern)

# Consciousness / NDE
link $R20 P66  # AWARE -> AWARE-II NDE Results
link $R21 P66  # AWARE-II -> AWARE-II NDE Results

# Microtubule / Quantum Biology
link $R22 P35  # Hameroff-Penrose -> Orch-OR
link $R23 P36  # Kalra -> Microtubule Excitation
link $R24 P37  # Khan -> Anesthetic Effects
link $R25 P78  # Donadi -> Gravity-Related Collapse (constrains)

# Psychological / Methodology
link $R26 P43  # Irwin -> Psi-Conducive Variables
link $R27 P39  # Braud -> Unconscious Processing
link $R28 P46  # Stokes -> Theoretical Frameworks
link $R29 P6   # Radin -> Ganzfeld Evidence (overview)
link $R30 P4   # Cardena -> Phenomenological Evidence

# Skeptical
link $R31 P55  # Blackmore -> Cognitive Explanations
link $R32 P55  # Alcock -> Cognitive Explanations
link $R33 P7   # Wiseman -> Remote Viewing

# Cultural
link $R34 P55  # Lesser -> Cognitive Explanations
link $R35 P55  # Schumaker -> Cognitive Explanations

# Additional
link $R36 P44  # Stanford PMIR -> PMIR
link $R37 P14  # Nelson GCP -> Micro-PK
link $R37 P73  # Nelson GCP -> Princeton PEAR Lab
link $R38 P6   # Bem-Honorton -> Ganzfeld Evidence
link $R38 P67  # Bem-Honorton -> Autoganzfeld Protocol
link $R39 P7   # Utts -> Remote Viewing
link $R39 P69  # Utts -> SRI/SAIC Programs
link $R40 P4   # Radin 2006 -> Phenomenological Evidence

echo ""
echo "=== Verifying links ==="
echo "P6 (Ganzfeld) refs:"
$CLI $F ref list --node P6 --format quiet 2>/dev/null | wc -l
echo "P10 (Bem) refs:"
$CLI $F ref list --node P10 --format quiet 2>/dev/null | wc -l
echo "P18 (QM Non-Locality) refs:"
$CLI $F ref list --node P18 --format quiet 2>/dev/null | wc -l
echo "Done."
