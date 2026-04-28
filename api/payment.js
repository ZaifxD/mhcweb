import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    method: { type: String, required: true },
    reason: { type: String, default: 'None' },
    status: { type: String, enum: ['pending', 'verified', 'cancelled'], default: 'pending' }
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
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing payment ID' });

    try {
        await connectToDatabase();
        const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
        
        const payment = await Payment.findOne({ paymentId: id });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });

        return res.status(200).json({
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            user: payment.userTag || payment.userId,
            reason: payment.reason
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
