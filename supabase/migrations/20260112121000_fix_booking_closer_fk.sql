-- Change foreign key to point to profiles for easier joining
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_closer_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_closer_id_fkey FOREIGN KEY (closer_id) REFERENCES profiles(id);
