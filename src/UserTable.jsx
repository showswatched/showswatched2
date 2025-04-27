import React from 'react';

export default function UserTable({ users, onSelectUser }) {
  return (
    <table className="admin-user-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Display Name</th>
          <th>Status</th>
          <th>Roles</th>
          <th>Stats</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.uid}>
            <td>{user.email}</td>
            <td>{user.displayName}</td>
            <td>{user.disabled ? 'Inactive' : 'Active'}</td>
            <td>{user.roles ? user.roles.join(', ') : ''}</td>
            <td>
              Diary: {user.stats?.diaryCount || 0}<br />
              Comments: {user.stats?.commentCount || 0}
            </td>
            <td>
              <button onClick={() => onSelectUser(user)}>Manage</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
