import { Request, Response } from 'express';
import * as listingRepository from '../repositories/listingRepository';

export async function getListingByExternalId(req: Request, res: Response): Promise<void> {
  const externalListingId = req.params.externalListingId;
  if (!externalListingId) {
    res.status(400).json({ ok: false, error: 'externalListingId required' });
    return;
  }

  const listing = await listingRepository.findByExternalId(externalListingId);
  if (!listing) {
    res.status(404).json({
      ok: false,
      error: 'Listing not found',
      externalListingId,
    });
    return;
  }

  res.status(200).json({
    ok: true,
    listing: {
      externalListingId: listing.externalListingId,
      title: listing.title,
      city: listing.city,
      zone: listing.zone,
      address: listing.address,
      price: listing.price,
      propertyType: listing.propertyType,
      contractType: listing.contractType,
      surfaceM2: listing.surfaceM2,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      updatedAt: listing.updatedAt,
    },
  });
}
