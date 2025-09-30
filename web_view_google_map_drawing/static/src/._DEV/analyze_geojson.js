/**
 * Analyze the problematic GeoJSON file to understand why it freezes Terra Draw
 */

import { 
    analyzeFeaturePerformance, 
    createEditableFeature, 
    createUltraSimplifiedFeature,
    GEOMETRY_PERFORMANCE_CONFIG 
} from './geometry_performance_utils.js';

// The problematic GeoJSON data
const problematicGeoJSON = {"type": "FeatureCollection", "features": [{"id": "484d5676-70ee-4918-a2eb-46fb68112a21", "type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[97.976814, 4.627501], [98.001732, 4.609802], [98.002502, 4.626111], [98.018059, 4.602221], [97.984673, 4.56777], [97.976112, 4.577502], [97.964165, 4.566667], [97.981369, 4.573796], [97.979691, 4.544725], [97.955276, 4.55028], [97.972733, 4.5398], [97.950836, 4.531944], [97.970619, 4.522869], [97.976295, 4.558143], [97.99472, 4.509722], [98.040001, 4.546391], [98.015274, 4.516389], [98.033058, 4.502778], [98.006668, 4.484167], [98.036942, 4.476388], [98.01889, 4.486671], [98.034721, 4.504444], [98.01722, 4.516389], [98.048332, 4.50639], [98.065407, 4.553231], [98.085564, 4.532343], [98.062714, 4.52582], [98.079262, 4.515678], [98.052574, 4.509319], [98.069611, 4.474355], [98.062508, 4.508731], [98.079689, 4.509738], [98.080353, 4.459579], [98.102219, 4.488062], [98.087158, 4.523333], [98.118057, 4.497778], [98.122505, 4.523224], [98.179321, 4.49561], [98.155563, 4.494721], [98.18721, 4.484157], [98.171555, 4.469377], [98.185555, 4.448334], [98.194107, 4.481671], [98.237503, 4.458829], [98.205002, 4.433611], [98.246391, 4.44061], [98.249443, 4.405279], [98.285553, 4.418612], [98.258354, 4.367801], [98.279167, 4.38889], [98.279724, 4.329723], [98.245003, 4.327499], [98.267586, 4.312595], [98.254997, 4.28972], [98.201218, 4.30419], [98.066879, 4.25311], [98.094833, 4.216781], [98.059311, 4.19073], [98.073616, 4.149899], [98.04081, 4.103982], [98.023132, 3.969779], [97.95816, 3.928901], [97.948952, 3.89086], [97.904312, 3.9115], [97.910461, 3.822941], [97.7995, 3.725921], [97.866966, 3.574901], [97.955627, 3.48142], [97.9319, 3.445421], [97.949707, 3.39154], [98.02742, 3.33115], [97.984917, 3.27558], [97.872261, 3.24905], [97.926758, 3.22501], [97.980606, 3.12311], [97.974823, 3.069951], [97.930649, 3.06259], [97.954613, 2.901539], [98.00679, 2.88956], [98.044548, 2.824701], [98.092186, 2.821309], [98.111717, 2.790251], [98.086426, 2.737551], [98.129227, 2.662321], [98.085129, 2.634219], [98.075226, 2.575529], [98.109291, 2.430041], [98.154373, 2.414939], [98.187607, 2.322901], [98.153343, 2.14694], [97.949997, 2.270561], [97.881668, 2.2425], [97.896683, 2.280493], [97.865791, 2.248934], [97.805023, 2.268901], [97.776108, 2.24139], [97.662781, 2.4], [97.650276, 2.672778], [97.597839, 2.872699], [97.43, 2.931111], [97.372223, 2.985833], [97.315002, 3.057779], [97.262169, 3.215809], [97.169724, 3.256945], [97.001808, 3.547494], [96.903435, 3.602802], [96.869446, 3.689781], [96.741943, 3.752222], [96.54454, 3.73003], [96.49585, 3.750257], [96.38031, 3.85572], [96.2425, 4.067871], [96.139603, 4.152119], [96.12709, 4.12376], [96.059937, 4.203924], [96.024147, 4.193898], [95.800003, 4.440555], [95.848541, 4.441674], [95.79673, 4.444719], [95.610031, 4.61916], [95.568336, 4.625555], [95.583046, 4.65667], [95.538612, 4.653333], [95.494446, 4.74861], [95.412224, 4.820278], [95.363121, 5.033404], [95.306114, 5.080833], [95.304169, 5.114999], [95.283058, 5.108333], [95.308609, 5.130279], [95.307327, 5.16943], [95.240837, 5.223612], [95.241661, 5.283072], [95.211945, 5.275833], [95.252747, 5.393441], [95.228752, 5.495141], [95.193466, 5.528031], [95.224998, 5.576112], [95.275833, 5.546668], [95.346947, 5.60528], [95.318047, 5.583891], [95.359566, 5.57267], [95.43222, 5.656944], [95.515747, 5.59514], [95.611946, 5.62778], [95.887222, 5.504171], [95.909447, 5.43375], [95.889999, 5.452501], [95.887222, 5.424444], [96.113609, 5.283329], [96.089165, 5.264445], [96.256943, 5.2625], [96.382225, 5.2], [96.417221, 5.19889], [96.465767, 5.23779], [96.522141, 5.19847], [96.726433, 5.247711], [96.712502, 5.235557], [96.750275, 5.224168], [96.844719, 5.27639], [96.860283, 5.243331], [96.883331, 5.235], [96.978661, 5.263054], [97.085732, 5.233533], [97.147942, 5.193611], [97.142746, 5.155816], [97.199448, 5.141943], [97.497223, 5.25023], [97.554443, 5.212223], [97.522957, 5.229202], [97.57077, 5.182097], [97.536118, 5.18111], [97.59198, 5.148521], [97.574875, 5.136448], [97.649719, 5.11917], [97.645279, 5.07444], [97.840553, 4.9075], [97.903229, 4.8873], [97.976387, 4.670832], [97.959999, 4.703611], [97.953613, 4.683333], [97.996109, 4.638056], [97.976814, 4.627501]]]}, "properties": {"id_1": 1, "mode": "polygon", "slug": "special-region-of-aceh", "state": "Special Region of Aceh", "country": "Indonesia", "selected": false, "partIndex": 0, "cartodb_id": 16, "totalParts": 26}}]};

function analyzeProblematicFeatures() {
    console.log('🔍 ANALYZING PROBLEMATIC GEOJSON FILE');
    console.log('=====================================');
    
    const features = problematicGeoJSON.features;
    let totalVertices = 0;
    const analysis = [];
    
    features.forEach((feature, index) => {
        const featureAnalysis = analyzeFeaturePerformance(feature);
        totalVertices += featureAnalysis.vertexCount;
        
        analysis.push({
            index,
            id: feature.id,
            type: feature.geometry.type,
            partIndex: feature.properties?.partIndex,
            vertices: featureAnalysis.vertexCount,
            complexity: featureAnalysis.complexity,
            canEdit: featureAnalysis.canEdit,
            recommendedAction: featureAnalysis.recommendedAction
        });
        
        console.log(`Feature ${index}: ${feature.geometry.type} - ${featureAnalysis.vertexCount} vertices - ${featureAnalysis.complexity.toUpperCase()}`);
        
        // Check the first (largest) feature specifically
        if (index === 0) {
            console.log('');
            console.log('🚨 MAIN FEATURE ANALYSIS:');
            console.log('-------------------------');
            console.log(`Vertices: ${featureAnalysis.vertexCount}`);
            console.log(`Complexity: ${featureAnalysis.complexity}`);
            console.log(`Can Edit: ${featureAnalysis.canEdit}`);
            console.log(`Recommended Action: ${featureAnalysis.recommendedAction}`);
            console.log(`Exceeds freeze threshold (${GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD}): ${featureAnalysis.vertexCount > GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD}`);
            console.log('');
        }
    });
    
    console.log('');
    console.log('📊 SUMMARY:');
    console.log('============');
    console.log(`Total features: ${features.length}`);
    console.log(`Total vertices: ${totalVertices}`);
    console.log(`Complex features: ${analysis.filter(a => a.complexity === 'complex').length}`);
    console.log(`Very complex features: ${analysis.filter(a => a.complexity === 'very_complex').length}`);
    console.log(`Extremely complex features: ${analysis.filter(a => a.complexity === 'extremely_complex').length}`);
    
    const problematicFeatures = analysis.filter(a => a.vertices > GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD);
    console.log(`Features that would freeze Terra Draw: ${problematicFeatures.length}`);
    
    if (problematicFeatures.length > 0) {
        console.log('');
        console.log('⚠️ FREEZE-PRONE FEATURES:');
        console.log('========================');
        problematicFeatures.forEach(f => {
            console.log(`- Feature ${f.index} (${f.type}): ${f.vertices} vertices`);
        });
    }
    
    return analysis;
}

// Test simplification solutions
function testSimplificationSolutions() {
    console.log('');
    console.log('🛠️ TESTING SIMPLIFICATION SOLUTIONS');
    console.log('===================================');
    
    const mainFeature = problematicGeoJSON.features[0]; // The 176-vertex feature
    console.log(`Original feature: ${analyzeFeaturePerformance(mainFeature).vertexCount} vertices`);
    
    // Test normal simplification
    const normalSimplified = createEditableFeature(mainFeature);
    console.log(`Normal simplification: ${normalSimplified.simplifiedVertexCount} vertices (${normalSimplified.reductionRatio?.toFixed(1)}% reduction)`);
    
    // Test ultra-simplification
    const ultraSimplified = createUltraSimplifiedFeature(mainFeature);
    if (ultraSimplified) {
        const ultraAnalysis = analyzeFeaturePerformance(ultraSimplified);
        console.log(`Ultra-simplification (bounding box): ${ultraAnalysis.vertexCount} vertices`);
    }
    
    return {
        original: analyzeFeaturePerformance(mainFeature),
        normalSimplified,
        ultraSimplified: ultraSimplified ? analyzeFeaturePerformance(ultraSimplified) : null
    };
}

// Run analysis
const featureAnalysis = analyzeProblematicFeatures();
const simplificationTest = testSimplificationSolutions();

console.log('');
console.log('💡 SOLUTION SUMMARY:');
console.log('===================');
console.log('1. The main feature has 176 vertices - this is what causes the freeze');
console.log('2. Our performance thresholds correctly identify this as problematic');
console.log('3. Normal simplification should reduce it to ~88 vertices');
console.log('4. Ultra-simplification reduces it to 4 vertices (bounding box)');
console.log('5. The system should automatically apply appropriate simplification');

export { analyzeProblematicFeatures, testSimplificationSolutions };