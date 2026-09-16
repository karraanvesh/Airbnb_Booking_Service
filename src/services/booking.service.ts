import { CreateBookingDTO } from '../dto/booking.dto';
import { confirmBooking, createBooking, createIdempotencyKey, finalizeIdempotencyKey, getIdempotencyKeyWithLock } from '../repositories/booking.repository';
import { BadRequestError, InternalServerError, NotFoundError } from '../utils/errors/app.error';
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey';
import prismaClient from '../prisma/client.ts';
import {redlock} from '../config/redis.config.ts';
import { serverConfig } from '../config/index.ts';

export async function createBookingService(createBookingDTO: CreateBookingDTO) {

    const ttl = serverConfig.LOCK_TTL;
    const bookingResource = `hotel:${createBookingDTO.hotelId}`;

    try {
        await redlock.acquire([bookingResource] , ttl);
        // console.log(`Lock acquired for resource: ${bookingResource}` , lock);

        const booking = await createBooking({
            userId: createBookingDTO.userId,
            hotelId: createBookingDTO.hotelId,
            totalGuests: createBookingDTO.totalGuests,
            bookingAmount: createBookingDTO.bookingAmount,
        });

        const idempotencyKey = generateIdempotencyKey();

        await createIdempotencyKey(idempotencyKey, booking.id);

        return {
            bookingId: booking.id,
            idempotencyKey: idempotencyKey,
        };
    } catch (error) {
        throw new InternalServerError(`Failed to acquire lock for booking resource`);
    }

    // return await redlock.using([bookingResource] , ttl , async () => {
    //     
    // });


}

// Todo: explore the function for potential issues and improvements
export async function confirmBookingService(idempotencyKey: string) {

    return await prismaClient.$transaction(async (tx) => {
        const idempotencyKeyData = await getIdempotencyKeyWithLock(tx , idempotencyKey);

        if(!idempotencyKeyData || idempotencyKeyData instanceof NotFoundError) {
            throw new NotFoundError('Idempotency key not found');
        }

        if(idempotencyKeyData.finalizedAt) {
            throw new BadRequestError('Idempotency key already finalized');
        }

        const booking = await confirmBooking(tx , idempotencyKeyData.bookingId);
        await finalizeIdempotencyKey(tx , idempotencyKey);

        return booking;
    });
}
