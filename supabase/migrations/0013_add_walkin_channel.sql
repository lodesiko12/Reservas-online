-- Canal "walkin" (cliente sin reserva que llega y se sienta directamente).
alter type public.booking_channel add value if not exists 'walkin';
