from rest_framework.renderers import JSONRenderer

DATABASE_CHUNK_SIZE = 1000
RESPONSE_CHUNK_BYTES = 64 * 1024


def stream_vehicle_detail(serializer, maintenance_records):
    """Keep the normal detail schema without materializing its entire history."""
    record_serializer = serializer.fields.pop("maintenance_records").child
    renderer = JSONRenderer()
    # Serialize the envelope before returning a response so its errors remain
    # ordinary HTTP errors, rather than failures after streaming has started.
    envelope = renderer.render(serializer.data)
    return _stream_history(envelope, maintenance_records, record_serializer, renderer)


def _stream_history(envelope, maintenance_records, serializer, renderer):
    records = maintenance_records.iterator(chunk_size=DATABASE_CHUNK_SIZE)
    try:
        yield envelope[:-1] + b',"maintenance_records":['
        buffer = bytearray()
        separator = b""

        for record in records:
            buffer.extend(separator)
            buffer.extend(renderer.render(serializer.to_representation(record)))
            separator = b","
            if len(buffer) >= RESPONSE_CHUNK_BYTES:
                yield bytes(buffer)
                buffer.clear()

        if buffer:
            yield bytes(buffer)
        yield b"]}"
    finally:
        # Closing the response (including a disconnected client) also closes the
        # queryset iterator and releases its database cursor.
        records.close()
