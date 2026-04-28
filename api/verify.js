import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    channelId: { type: String },
    messageId: { type: String },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    method: { type: String, required: true },
    status: { type: String, enum: ['pending', 'verified', 'cancelled'], default: 'pending' },
    trxId: { type: String },
    verifiedAt: { type: Date }
}, { strict: false });

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('Please define the MONGODB_URI environment variable in Vercel');
    const conn = await mongoose.connect(uri);
    cachedDb = conn;
    return conn;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id, trxId } = req.body;
    if (!id || !trxId) return res.status(400).json({ error: 'Missing parameters' });

    // Mock Test Verification
    if (id === 'TEST') {
        return res.status(200).json({ success: true, discordUrl: 'https://discord.com' });
    }

    try {
        await connectToDatabase();
        const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
        
        const payment = await Payment.findOne({ paymentId: id });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        if (payment.status !== 'pending') return res.status(400).json({ error: 'Payment is not pending.' });

        // Update Database
        payment.status = 'verified';
        payment.trxId = trxId;
        payment.verifiedAt = new Date();
        await payment.save();

        let discordUrl = null;

        // Edit the Discord Message using REST API
        if (payment.channelId && payment.messageId && process.env.DISCORD_BOT_TOKEN) {
            
            const embed = {
                title: '✅ Payment Verified!',
                color: 5763719, // #57F287
                description: `This payment has been successfully verified via the Vercel Web Portal!\n\n**Amount:** \`${payment.amount} ${payment.currency}\`\n**Method:** \`${payment.method}\`\n**Transaction ID:** \`${payment.trxId}\``,
                fields: [
                    { name: '👤 Buyer', value: `<@${payment.userId}>`, inline: true },
                    { name: '🛡️ Admin', value: `<@${payment.adminId}>`, inline: true }
                ],
                footer: { text: `Payment ID: ${payment.paymentId}` },
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`https://discord.com/api/v10/channels/${payment.channelId}/messages/${payment.messageId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: `✅ Payment Verified for <@${payment.userId}>!`,
                    embeds: [embed],
                    components: [] // Clear the components (removes the Pay button)
                })
            });

            if (response.ok) {
                discordUrl = `https://discord.com/channels/${payment.guildId}/${payment.channelId}/${payment.messageId}`;
            }
        }

        return res.status(200).json({ success: true, discordUrl });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
