
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../service-account-key.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkConfig() {
    console.log("Checking Inbound Agents Config...");
    const snapshot = await db.collection('subworkspaces').get();

    if (snapshot.empty) {
        console.log("No subworkspaces found.");
        return;
    }

    snapshot.forEach((doc: any) => {
        const data = doc.data();
        // Filter loose - show all to be safe, or just inbound/relevant
        console.log(`\nID: ${doc.id}`);
        console.log(`Name: ${data.name}`);
        console.log(`Type: ${data.type}`);
        console.log(`Retell Agent ID: ${data.retell_agent_id}`);
        console.log(`Config found: ${!!data.analysis_config}`);
        if (data.analysis_config) {
            console.log(`Custom Fields: ${data.analysis_config.custom_fields?.length || 0}`);
            data.analysis_config.custom_fields?.forEach(f => {
                console.log(` - ${f.name} (Archived: ${f.isArchived})`);
            });
        }
    });
}

checkConfig().catch(console.error);
