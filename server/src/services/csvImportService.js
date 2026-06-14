const csv = require("csv-parser");
const stream = require("stream");

exports.parseCsv =
async (buffer) => {

  return new Promise(
    (resolve, reject) => {

      const rows = [];

      const readable =
        new stream.Readable();

      readable.push(buffer);
      readable.push(null);

      readable
        .pipe(csv())
        .on("data",
          row => rows.push(row))
        .on("end",
          () => resolve(rows))
        .on("error",
          reject);
    }
  );
};