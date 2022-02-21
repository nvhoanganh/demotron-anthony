# Import Pixie's module for querying data
import px

# Load the last 30 seconds of Pixie's `conn_stats` table into a Dataframe.
df = px.DataFrame(table='conn_stats', start_time='-30s')

# select column you want, you can run `px live px/schemas` to get the column list of tables and column names
# in this case we just want remote_addr,remote_port,conn_open,conn_close
df = df[['remote_addr','remote_port','conn_open', 'conn_close']]

# attach Context information
df.pod = df.ctx['pod']
df.service = df.ctx['service']

df = df[df['remote_port'] == 27017]

# Display the DataFrame with table formatting
px.display(df)