import React, { useState, useEffect, useCallback } from 'react';

// --- Constants ---
const DEXTROSE_SOLUTIONS = [
  { name: 'D50W', concentration: 0.50, gramsPerMl: 0.50 },
  { name: 'D25W', concentration: 0.25, gramsPerMl: 0.25 },
  { name: 'D10W', concentration: 0.10, gramsPerMl: 0.10 },
  { name: 'D5W', concentration: 0.05, gramsPerMl: 0.05 },
  { name: 'Sterile Water', concentration: 0.00, gramsPerMl: 0.00 },
];
const NACL_3_MEQ_PER_ML = 0.513; // 3g NaCl in 100ml -> 30g/L. Molar mass ~58.5g/mol. 30/58.5 ~ 0.513 mol/L or 513 mEq/L -> 0.513 mEq/ml
const KCL_MEQ_PER_ML = 2; // Standard concentration is often 2 mEq/ml

// Caloric constants (kcal/g or kcal/ml)
const KCAL_PER_GRAM_DEXTROSE = 3.4;
const KCAL_PER_GRAM_AMINO_ACID = 4.0;
const KCAL_PER_ML_LIPID_20 = 2.0; // 20% lipid emulsion provides 2.0 kcal/ml

// --- Helper Components ---
const InputField = ({ label, id, value, onChange, unit, placeholder, helpText }) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
      {label}
      {helpText && (
        <div className="group relative ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-gray-400" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.055.492.14.556.224.064.084.096.232.096.465 0 .273-.038.546-.11.816-.073.27-.186.522-.317.714-.13.188-.285.346-.46.477-.175.13-.37.217-.585.255l-.21.039-.257.257.257.257.21.039c.215.038.41.125.585.255.175.13.33.29.46.477.13.192.244.444.317.714.072.27.11.543.11.816 0 .233-.032.38-.096.465-.064.084-.262.17-.556.224l-.45.083.082.38.229.287zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
          </svg>
          <div className="absolute bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
            {helpText}
          </div>
        </div>
      )}
    </label>
    <div className="relative">
      <input
        type="number"
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder || '0'}
        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
        min="0"
        step="any"
      />
      {unit && <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">{unit}</span>}
    </div>
  </div>
);

const ResultCard = ({ title, children }) => (
  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const ResultRow = ({ label, value, unit, isHighlighted = false }) => (
  <div className={`flex justify-between items-center ${isHighlighted ? 'text-indigo-600 font-bold' : 'text-gray-700'}`}>
    <span className="text-sm">{label}</span>
    <span className={`text-right font-medium ${isHighlighted ? 'text-lg' : 'text-base'}`}>
      {value} <span className="text-xs text-gray-500">{unit}</span>
    </span>
  </div>
);

const DextroseMixResult = ({ mix }) => {
  if (mix.error) {
    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-bold">Calculation Error</p>
        <p className="text-sm">{mix.error}</p>
      </div>
    );
  }
  
  if (!mix.parts || mix.parts.length === 0) {
    return (
       <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
        <p className="text-sm">Enter values to calculate the dextrose mixture.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
      <p className="text-sm font-semibold text-indigo-800 mb-2">To prepare {mix.finalVolume.toFixed(2)} ml of Dextrose/Electrolyte fluid, mix:</p>
      <ul className="list-disc list-inside space-y-1 text-indigo-700">
        {mix.parts.map((part, index) => (
          <li key={index}>
            <span className="font-bold">{part.volume.toFixed(2)} ml</span> of {part.name}
          </li>
        ))}
        {mix.naVolume > 0.001 && <li><span className="font-bold">{mix.naVolume.toFixed(2)} ml</span> of 3% NaCl</li>}
        {mix.kVolume > 0.001 && <li><span className="font-bold">{mix.kVolume.toFixed(2)} ml</span> of KCl (2 mEq/ml)</li>}
        {mix.caVolume > 0.001 && <li><span className="font-bold">{mix.caVolume.toFixed(2)} ml</span> of 10% Calcium Gluconate</li>}
      </ul>
      <p className="text-xs text-indigo-500 mt-3">This provides {mix.targetGrams.toFixed(2)}g of Dextrose at a final concentration of {(mix.finalConcentration * 100).toFixed(1)}%.</p>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [inputs, setInputs] = useState({
    weight: '',
    tfi: '150',
    feeds: '',
    meds: '',
    aminoAcids: '3.5',
    lipids: '3',
    sodium: '3',
    potassium: '2',
    calcium: '2',
    gir: '8',
  });

  const [selectedDextrose, setSelectedDextrose] = useState(DEXTROSE_SOLUTIONS.map(s => s.name));
  const [results, setResults] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleDextroseSelection = (e) => {
    const { name, checked } = e.target;
    if (checked) {
      setSelectedDextrose(prev => [...prev, name]);
    } else {
      setSelectedDextrose(prev => prev.filter(item => item !== name));
    }
  };

  const calculateTPN = useCallback(() => {
    const weight = parseFloat(inputs.weight) || 0;
    const tfi = parseFloat(inputs.tfi) || 0;
    const feedsVolume = parseFloat(inputs.feeds) || 0;
    const medsVolume = parseFloat(inputs.meds) || 0;
    const aaDose = parseFloat(inputs.aminoAcids) || 0;
    const lipidDose = parseFloat(inputs.lipids) || 0;
    const naDose = parseFloat(inputs.sodium) || 0;
    const kDose = parseFloat(inputs.potassium) || 0;
    const caDose = parseFloat(inputs.calcium) || 0;
    const gir = parseFloat(inputs.gir) || 0;

    if (weight === 0) {
      setResults(null);
      return;
    }

    // --- Fluid Calculations ---
    const totalFluidIntake = weight * tfi;
    const parenteralFluidVolume = totalFluidIntake - feedsVolume - medsVolume;

    // --- Macronutrient Calculations ---
    const aaGrams = weight * aaDose;
    const aaVolume = aaGrams / 0.10; // 10% solution
    const aaRate = aaVolume / 24;

    const lipidGrams = weight * lipidDose;
    const lipidVolume = lipidGrams / 0.20; // 20% solution
    const lipidRate = lipidVolume / 24;

    const dextroseAndElectrolyteVolume = Math.max(0, parenteralFluidVolume - aaVolume - lipidVolume);
    const dextroseAndElectrolyteRate = dextroseAndElectrolyteVolume / 24;
    
    const totalDextroseGramsPerDay = (gir * weight * 1440) / 1000;

    // --- Calorie Calculations ---
    const dextroseCalories = totalDextroseGramsPerDay * KCAL_PER_GRAM_DEXTROSE;
    const aaCalories = aaGrams * KCAL_PER_GRAM_AMINO_ACID;
    const lipidCalories = lipidVolume * KCAL_PER_ML_LIPID_20; // Using volume for 20% lipids
    const totalCalories = dextroseCalories + aaCalories + lipidCalories;
    const totalCaloriesPerKg = weight > 0 ? totalCalories / weight : 0;

    // --- Calorie Percentage Calculations ---
    const dextrosePercentage = totalCalories > 0 ? (dextroseCalories / totalCalories) * 100 : 0;
    const aaPercentage = totalCalories > 0 ? (aaCalories / totalCalories) * 100 : 0;
    const lipidPercentage = totalCalories > 0 ? (lipidCalories / totalCalories) * 100 : 0;

    // --- Dextrose Mixture Calculation ---
    const calculateDextroseMix = () => {
        const FIXED_VOLUME = 60;
        
        if (dextroseAndElectrolyteVolume <= 0) {
            return { error: "No volume available for Dextrose/Electrolyte infusion." };
        }

        // Correction factor to scale the 24h electrolyte dose to the 60ml preparation volume
        const correctionFactor = FIXED_VOLUME / dextroseAndElectrolyteVolume;

        // Calculate the PROPORTIONAL amount of electrolytes for the 60ml syringe
        const dailyNaMeq = weight * naDose;
        const proportionalNaMeq = dailyNaMeq * correctionFactor;
        const naVolume = proportionalNaMeq / NACL_3_MEQ_PER_ML;

        const dailyKMeq = weight * kDose;
        const proportionalKMeq = dailyKMeq * correctionFactor;
        const kVolume = proportionalKMeq / KCL_MEQ_PER_ML;
        
        const dailyCaVolumeDose = weight * caDose;
        const caVolume = dailyCaVolumeDose * correctionFactor;

        const totalElectrolyteVolume = naVolume + kVolume + caVolume;

        if (totalElectrolyteVolume >= FIXED_VOLUME) {
            return { error: `Proportional electrolyte volume (${totalElectrolyteVolume.toFixed(2)} ml) exceeds the fixed ${FIXED_VOLUME}ml limit.` };
        }

        const availableVolumeForDextrose = FIXED_VOLUME - totalElectrolyteVolume;
        const dailyDextroseConcentration = dextroseAndElectrolyteVolume > 0 ? totalDextroseGramsPerDay / dextroseAndElectrolyteVolume : 0;
        const targetGramsIn60ml = dailyDextroseConcentration * FIXED_VOLUME;
        const targetConcentration = availableVolumeForDextrose > 0 ? targetGramsIn60ml / availableVolumeForDextrose : 0;

        const availableSolutions = DEXTROSE_SOLUTIONS
            .filter(s => selectedDextrose.includes(s.name))
            .sort((a, b) => b.concentration - a.concentration);

        if (availableSolutions.length === 0) {
            return { error: "Please select at least one dextrose solution." };
        }
        
        if (targetConcentration > availableSolutions[0].concentration) {
            return { error: `Required concentration (${(targetConcentration*100).toFixed(1)}%) is higher than the max available solution (${(availableSolutions[0].concentration*100).toFixed(1)}% - ${availableSolutions[0].name}).` };
        }

        let highSolution = null;
        let lowSolution = null;

        for (let i = 0; i < availableSolutions.length; i++) {
            if (availableSolutions[i].concentration >= targetConcentration) {
                highSolution = availableSolutions[i];
            }
        }
        for (let i = availableSolutions.length - 1; i >= 0; i--) {
             if (availableSolutions[i].concentration <= targetConcentration) {
                lowSolution = availableSolutions[i];
            }
        }
        
        if (!highSolution) highSolution = availableSolutions[0];
        if (!lowSolution) lowSolution = availableSolutions[availableSolutions.length - 1];

        if (highSolution.concentration === lowSolution.concentration) {
            if (Math.abs(highSolution.concentration - targetConcentration) > 0.001) {
                return { error: `Cannot achieve target GIR with only ${highSolution.name}. Please select another solution to mix with.` };
            }
            return {
                parts: [{ name: highSolution.name, volume: availableVolumeForDextrose }],
                naVolume, kVolume, caVolume, finalVolume: FIXED_VOLUME, targetGrams: targetGramsIn60ml, finalConcentration: dailyDextroseConcentration,
            };
        }
        
        const C_h = highSolution.gramsPerMl;
        const C_l = lowSolution.gramsPerMl;

        let volumeHigh = (targetGramsIn60ml - availableVolumeForDextrose * C_l) / (C_h - C_l);
        let volumeLow = availableVolumeForDextrose - volumeHigh;
        
        if (volumeHigh < -0.001 || volumeLow < -0.001) {
             return { error: `Could not compute a valid mixture with ${highSolution.name} and ${lowSolution.name}. Try selecting a different pair of solutions.` };
        }

        return {
            parts: [
                { name: highSolution.name, volume: Math.max(0, volumeHigh) },
                { name: lowSolution.name, volume: Math.max(0, volumeLow) }
            ].filter(p => p.volume > 0.001),
            naVolume, kVolume, caVolume, finalVolume: FIXED_VOLUME, targetGrams: targetGramsIn60ml, finalConcentration: dailyDextroseConcentration,
        };
    };

    const dextroseMix = calculateDextroseMix();

    setResults({
      totalFluidIntake, parenteralFluidVolume, aaVolume, aaRate, lipidVolume, lipidRate,
      dextroseAndElectrolyteVolume, dextroseAndElectrolyteRate, dextroseMix,
      dextroseCalories, aaCalories, lipidCalories, totalCalories, totalCaloriesPerKg,
      dextrosePercentage, aaPercentage, lipidPercentage
    });

  }, [inputs, selectedDextrose]);

  useEffect(() => {
    calculateTPN();
  }, [calculateTPN]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-indigo-600">TPNeo</h1>
          <p className="mt-2 text-lg text-gray-600">by Dr Abhishek</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Column */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-3">Patient Inputs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <InputField label="Weight" id="weight" value={inputs.weight} onChange={handleInputChange} unit="kg" placeholder="e.g., 1.5" />
                <InputField label="Total Fluid Intake (TFI)" id="tfi" value={inputs.tfi} onChange={handleInputChange} unit="ml/kg/day" />
                <InputField label="Enteral Feeds Volume" id="feeds" value={inputs.feeds} onChange={handleInputChange} unit="ml/24h" helpText="Total volume of milk/formula given over 24 hours."/>
                <InputField label="IV Meds/Flushes" id="meds" value={inputs.meds} onChange={handleInputChange} unit="ml/24h" helpText="Total volume of antibiotics, injections, and flushes over 24 hours."/>
                <InputField label="Amino Acids (10%)" id="aminoAcids" value={inputs.aminoAcids} onChange={handleInputChange} unit="g/kg/day" />
                <InputField label="Lipids (20%)" id="lipids" value={inputs.lipids} onChange={handleInputChange} unit="g/kg/day" />
                <InputField label="Sodium (as 3% NaCl)" id="sodium" value={inputs.sodium} onChange={handleInputChange} unit="mEq/kg/day" />
                <InputField label="Potassium (as KCl)" id="potassium" value={inputs.potassium} onChange={handleInputChange} unit="mEq/kg/day" />
                <InputField label="Calcium Gluconate 10%" id="calcium" value={inputs.calcium} onChange={handleInputChange} unit="ml/kg/day" />
                <InputField label="Glucose Infusion Rate (GIR)" id="gir" value={inputs.gir} onChange={handleInputChange} unit="mg/kg/min" />
            </div>
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Available Dextrose Solutions</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {DEXTROSE_SOLUTIONS.map(solution => (
                  <div key={solution.name} className="flex items-center">
                    <input
                      id={solution.name}
                      name={solution.name}
                      type="checkbox"
                      checked={selectedDextrose.includes(solution.name)}
                      onChange={handleDextroseSelection}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={solution.name} className="ml-2 block text-sm text-gray-900">{solution.name}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Output Column */}
          <div className="space-y-8">
            {results ? (
              <>
                <ResultCard title="Fluid Summary">
                  <ResultRow label="Total Fluid Intake (TFI)" value={results.totalFluidIntake.toFixed(2)} unit="ml/day" />
                  <ResultRow label="Total Parenteral Nutrition (PN)" value={results.parenteralFluidVolume.toFixed(2)} unit="ml/day" isHighlighted={true} />
                </ResultCard>

                {/* --- UPDATED CALORIE CARD --- */}
                <ResultCard title="Calorie Summary">
                    <div className="flex justify-between items-center text-gray-700">
                        <span className="text-sm">Calories from Dextrose</span>
                        <div className="text-right">
                            <span className="font-medium text-base">
                                {results.dextroseCalories.toFixed(1)}
                                <span className="text-xs text-gray-500 ml-1">kcal/day</span>
                            </span>
                            <span className="font-medium text-sm text-gray-500 ml-2 w-16 inline-block">
                                ({results.dextrosePercentage.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-gray-700">
                        <span className="text-sm">Calories from Amino Acids</span>
                        <div className="text-right">
                            <span className="font-medium text-base">
                                {results.aaCalories.toFixed(1)}
                                <span className="text-xs text-gray-500 ml-1">kcal/day</span>
                            </span>
                            <span className="font-medium text-sm text-gray-500 ml-2 w-16 inline-block">
                                ({results.aaPercentage.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-gray-700">
                        <span className="text-sm">Calories from Lipids</span>
                        <div className="text-right">
                            <span className="font-medium text-base">
                                {results.lipidCalories.toFixed(1)}
                                <span className="text-xs text-gray-500 ml-1">kcal/day</span>
                            </span>
                            <span className="font-medium text-sm text-gray-500 ml-2 w-16 inline-block">
                                ({results.lipidPercentage.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                    <hr/>
                    <ResultRow label="Total Parenteral Calories" value={results.totalCalories.toFixed(1)} unit="kcal/day" isHighlighted={true} />
                    <ResultRow label="Total Parenteral Calories per kg" value={results.totalCaloriesPerKg.toFixed(1)} unit="kcal/kg/day" isHighlighted={true} />
                </ResultCard>
                
                <ResultCard title="Infusion Rates">
                   <ResultRow label="Amino Acids (10%) Volume" value={results.aaVolume.toFixed(2)} unit="ml/day" />
                   <ResultRow label="Amino Acid Rate" value={results.aaRate.toFixed(2)} unit="ml/hr" isHighlighted={true}/>
                   <hr/>
                   <ResultRow label="Lipids (20%) Volume" value={results.lipidVolume.toFixed(2)} unit="ml/day" />
                   <ResultRow label="Lipid Rate" value={results.lipidRate.toFixed(2)} unit="ml/hr" isHighlighted={true}/>
                   <hr/>
                   <ResultRow label="Dextrose/Electrolyte Volume" value={results.dextroseAndElectrolyteVolume.toFixed(2)} unit="ml/day" />
                   <ResultRow label="Dextrose/Electrolyte Rate" value={results.dextroseAndElectrolyteRate.toFixed(2)} unit="ml/hr" isHighlighted={true}/>
                </ResultCard>

                <ResultCard title="Dextrose/Electrolyte Preparation">
                   <p className="text-sm text-gray-600">This calculation is for preparing a standard <span className="font-bold">60 ml</span> syringe for infusion.</p>
                   <DextroseMixResult mix={results.dextroseMix} />
                </ResultCard>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-white p-6 rounded-xl shadow-md border border-gray-200">
                <p className="text-gray-500">Enter patient weight to see results.</p>
              </div>
            )}
          </div>
        </div>
        
        <footer className="text-center mt-12 text-sm text-gray-500">
            <p>Disclaimer: This tool is for educational purposes only and should not replace clinical judgment. Verify all calculations before clinical use.</p>
        </footer>
      </div>
    </div>
  );
}
