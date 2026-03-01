export class Serializer {
    static serialize(data) {
        try {
            return JSON.stringify(data);
        } catch (e) {
            console.error('Serialization failed:', e);
            return null;
        }
    }

    static deserialize(json) {
        try {
            return JSON.parse(json);
        } catch (e) {
            console.error('Deserialization failed:', e);
            return null;
        }
    }
}
